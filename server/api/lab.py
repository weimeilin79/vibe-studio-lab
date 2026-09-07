"""/api/lab: verification for the hands-on steps.

Each endpoint reads the same ADK session store the dev UI writes to and
answers a concrete question the step asked the student to produce evidence
for. Nothing here greps source or trusts the page; it reads events.
"""
from __future__ import annotations

import ast
import json
import os
import signal
import subprocess
import sys
from collections import Counter

from fastapi import APIRouter

from agent import config, drive

from ..services.workers import workers

ROOT = config.ROOT
router = APIRouter(prefix="/api/lab", tags=["lab"])

STAGE_APPS = ["stage0_prompt", "stage1_fanout", "stage2_direction", "stage3_router", "vibestudio"]
DEV_UI_USERS = ["user", config.USER]      # adk web files chats under "user"


@router.get("/inspector")
async def inspector():
    """Is the mounted ADK dev UI ready, and which apps will it list."""
    apps = [a for a in STAGE_APPS if (ROOT / a / "agent.py").exists()]
    return {"up": True, "url": "/inspector/dev-ui/", "apps": apps}


def _texts(ev) -> list[str]:
    msg = getattr(ev, "message", None) or getattr(ev, "content", None)
    return [p.text for p in (getattr(msg, "parts", None) or []) if getattr(p, "text", None)]


async def _sessions(app_name: str):
    svc = drive.svc()
    out = []
    for user in DEV_UI_USERS:
        try:
            resp = await svc.list_sessions(app_name=app_name, user_id=user)
        except Exception:
            continue
        for meta in resp.sessions:
            s = await svc.get_session(app_name=app_name, user_id=user, session_id=meta.id)
            if s is not None:
                out.append((user, s))
    out.sort(key=lambda us: getattr(us[1], "last_update_time", 0) or 0)
    return out


def tools_wired(path=ROOT / "stage0_prompt" / "agent.py") -> list[str]:
    """Names in the `tools=[...]` list of the Agent(...) call, read from the
    file on disk. This is what the student edits in step 3."""
    try:
        tree = ast.parse(path.read_text())
    except (OSError, SyntaxError):
        return []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "Agent":
            for kw in node.keywords:
                if kw.arg == "tools" and isinstance(kw.value, ast.List):
                    return [e.id for e in kw.value.elts if isinstance(e, ast.Name)]
    return []


@router.get("/stage0")
async def stage0():
    """Evidence for step 3, read from the file and the session store: which
    tools are wired, whether the agent ran, and which tools it called."""
    sessions = await _sessions("stage0_prompt")
    calls: Counter = Counter()
    user_msgs: list[str] = []
    replies: list[str] = []
    for _, s in sessions:
        for ev in s.events:
            for f in ev.get_function_calls() or []:
                calls[f.name] += 1
            if getattr(ev, "author", "") == "user":
                user_msgs += _texts(ev)
            else:
                replies += _texts(ev)
    last_reply = replies[-1] if replies else ""
    wired = tools_wired()
    return {
        "tools_wired": wired,
        "tools_complete": {"check_trends", "read_back_catalog"} <= set(wired),
        "sessions": len(sessions),
        "latest_session_id": sessions[-1][1].id if sessions else None,
        "tool_calls": dict(calls),
        "called_trends": calls.get("check_trends", 0) > 0,
        "called_backcatalog": calls.get("read_back_catalog", 0) > 0,
        "turns": len(user_msgs),
        "last_reply": last_reply[:1200],
    }


EXPECTED_FANOUT = {("START", "scan_trends", "join_research"),
                   ("START", "read_backcatalog", "join_research")}


def join_defined(path=ROOT / "stage1_fanout" / "agent.py") -> bool:
    """Is join_research assigned a JoinNode(...) call in the file on disk."""
    try:
        tree = ast.parse(path.read_text())
    except (OSError, SyntaxError):
        return False
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "join_research" for t in node.targets):
            call = node.value
            if isinstance(call, ast.Call):
                fn = call.func
                name = fn.id if isinstance(fn, ast.Name) else getattr(fn, "attr", "")
                return name == "JoinNode"
    return False


def workflow_edges(path) -> list[tuple[str, ...]]:
    """The chains in the `edges=[...]` list of the Workflow(...) call, as
    tuples of names. Dict targets (routers) are rendered as 'route:{...}'."""
    try:
        tree = ast.parse(path.read_text())
    except (OSError, SyntaxError):
        return []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "Workflow":
            for kw in node.keywords:
                if kw.arg == "edges" and isinstance(kw.value, ast.List):
                    out = []
                    for el in kw.value.elts:
                        if isinstance(el, ast.Tuple):
                            names = []
                            for e in el.elts:
                                if isinstance(e, ast.Name):
                                    names.append(e.id)
                                elif isinstance(e, ast.Dict):
                                    names.append("route:{" + ", ".join(
                                        getattr(k, "value", "?") for k in e.keys) + "}")
                            out.append(tuple(names))
                    return out
    return []


def _node_name(ev) -> str | None:
    info = getattr(ev, "node_info", None)
    path = getattr(info, "path", None) if info is not None else None
    if not path and isinstance(info, dict):
        path = info.get("path")
    if not path:
        return None
    return path.rsplit("/", 1)[-1].split("@")[0]


@router.get("/stage1")
async def stage1():
    """Evidence for step 4b: the edge list in stage1_fanout/agent.py, and what
    the workflow's sessions show about which nodes ran and what they output."""
    edges = workflow_edges(ROOT / "stage1_fanout" / "agent.py")
    sessions = await _sessions("stage1_fanout")
    nodes: list[str] = []
    bundle = ""
    backcatalog_empty = None
    runs = 0
    for _, sess in sessions:
        for ev in sess.events:
            name = _node_name(ev)
            if not name:
                continue
            if name == "stage1_fanout":
                continue
            if name not in nodes:
                nodes.append(name)
            out = getattr(ev, "output", None)
            if name == "join_research" and isinstance(out, dict):
                bundle = json.dumps(out, ensure_ascii=False, indent=1)
                runs += 1
            if name == "read_backcatalog" and isinstance(out, dict):
                backcatalog_empty = not out.get("backcatalog")
    return {
        "edges": [list(e) for e in edges],
        "edges_complete": set(edges) == EXPECTED_FANOUT,
        "join_defined": join_defined(),
        "sessions": len(sessions),
        "runs": runs,
        "nodes_ran": nodes,
        "readers_ran": {"scan_trends", "read_backcatalog"} <= set(nodes),
        "joined": "join_research" in nodes,
        "backcatalog_empty": backcatalog_empty,
        "bundle": bundle[:2000],
    }


CHAIN_PROPOSER = ("join_research", "propose_directions")
CHAIN_GATE = CHAIN_PROPOSER + ("direction_gate",)


def proposer_defined(path=ROOT / "stage2_direction" / "agent.py") -> bool:
    """Is propose_directions assigned an Agent(...) call in the stage 2 file."""
    try:
        tree = ast.parse(path.read_text())
    except (OSError, SyntaxError):
        return False
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "propose_directions" for t in node.targets):
            call = node.value
            if isinstance(call, ast.Call):
                fn = call.func
                name = fn.id if isinstance(fn, ast.Name) else getattr(fn, "attr", "")
                return name in ("Agent", "LlmAgent")
    return False
CHAIN_PERSIST = CHAIN_GATE + ("persist_direction",)


def proposer_mode(path=ROOT / "agent" / "graph.py") -> str:
    """The `mode=` keyword on propose_directions = Agent(...), or the default
    an agent takes when used as a workflow node."""
    try:
        tree = ast.parse(path.read_text())
    except (OSError, SyntaxError):
        return "?"
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "propose_directions" for t in node.targets):
            call = node.value
            if isinstance(call, ast.Call):
                for kw in call.keywords:
                    if kw.arg == "mode" and isinstance(kw.value, ast.Constant):
                        return str(kw.value.value)
            return "single_turn (default for a node)"
    return "?"


def gate_has_request_input(path=ROOT / "agent" / "graph.py") -> bool:
    """Does direction_gate yield a RequestInput(...)? Read from the AST."""
    try:
        tree = ast.parse(path.read_text())
    except (OSError, SyntaxError):
        return False
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "direction_gate":
            for sub in ast.walk(node):
                if isinstance(sub, ast.Yield) and isinstance(sub.value, ast.Call) \
                        and getattr(sub.value.func, "id", "") == "RequestInput":
                    return True
    return False


@router.get("/stage2")
async def stage2():
    """Evidence for steps 4c and 4d: the edge list in stage2_direction/agent.py,
    which nodes ran, whether the graph suspended on a RequestInput and was
    answered, and what the latest session's state holds."""
    edges = workflow_edges(ROOT / "stage2_direction" / "agent.py")
    tail = next((e for e in edges if e and e[0] == "join_research"), ())
    sessions = await _sessions("stage2_direction")
    nodes: list[str] = []
    asked = answered = 0
    state: dict = {}
    proposed: list[str] = []
    for _, sess in sessions:
        for ev in sess.events:
            name = _node_name(ev)
            if name and name != "stage2_direction" and name not in nodes:
                nodes.append(name)
            if name == "propose_directions":
                for text in _texts(ev):
                    try:
                        cands = json.loads(text).get("candidates") or []
                    except (ValueError, AttributeError):
                        continue
                    proposed = [c.get("title", "") for c in cands if isinstance(c, dict)]
            for f in ev.get_function_calls() or []:
                if f.name == "adk_request_input":
                    asked += 1
            for r in ev.get_function_responses() or []:
                if r.name == "adk_request_input":
                    answered += 1
    if sessions:
        state = dict(sessions[-1][1].state or {})
    cands = state.get("candidates") or []
    return {
        "edges": [list(e) for e in edges],
        "chain": list(tail),
        "proposer_defined": proposer_defined(),
        "proposer_wired": tuple(tail[: len(CHAIN_PROPOSER)]) == CHAIN_PROPOSER,
        "gate_wired": tuple(tail[: len(CHAIN_GATE)]) == CHAIN_GATE,
        "persist_wired": tuple(tail[: len(CHAIN_PERSIST)]) == CHAIN_PERSIST,
        "gate_has_request_input": gate_has_request_input(),
        "proposer_mode": proposer_mode(),
        "sessions": len(sessions),
        "nodes_ran": nodes,
        "asked": asked,
        "answered": answered,
        "candidates": [c.get("title", "") for c in cands if isinstance(c, dict)],
        "proposed_titles": proposed,
        "direction": state.get("direction"),
        "user_prefs": state.get("user:prefs"),
        "state_keys": sorted(k for k in state.keys() if not k.startswith("_")),
    }


@router.get("/stage2/load")
async def stage2_load():
    return await _load_app("stage2_direction")


@router.get("/stage3/load")
async def stage3_load():
    return await _load_app("stage3_router")


async def _load_app(app: str):
    """Import a stage app in a fresh interpreter and report whether the
    Workflow accepts it. Anything ADK refuses shows up here as the same
    validation error adk web would raise."""
    import asyncio
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "-c",
        f"import {app}.agent as m; print(len(m.root_agent.graph.edges) if m.root_agent.graph else 0)",
        cwd=str(ROOT), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=90)
    except asyncio.TimeoutError:
        proc.kill()
        return {"ok": False, "error": "import timed out"}
    if proc.returncode == 0:
        return {"ok": True, "edges": int(out.decode().strip() or 0), "error": ""}
    text = err.decode(errors="replace")
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    # pydantic prints the ADK message on a "Value error, ..." line and then a
    # docs footer; the message is the part worth showing.
    said = [l for l in lines if l.startswith("Value error,")]
    msg = said[-1].removeprefix("Value error,").strip() if said else (lines[-1] if lines else text)
    return {"ok": False, "error": msg[:600]}


def _assigned_call(path, name: str) -> str | None:
    """For `name = Something(...)` at module level, the callee's name; for
    `def name(...)`, "def"; None when neither is present."""
    try:
        tree = ast.parse(path.read_text())
    except (OSError, SyntaxError):
        return None
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return "def"
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets):
            call = node.value
            if isinstance(call, ast.Call):
                fn = call.func
                return fn.id if isinstance(fn, ast.Name) else getattr(fn, "attr", None)
            return None
    return None


def _mode_kw(path, name: str) -> str | None:
    try:
        tree = ast.parse(path.read_text())
    except (OSError, SyntaxError):
        return None
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets) and isinstance(node.value, ast.Call):
            for kw in node.value.keywords:
                if kw.arg == "mode" and isinstance(kw.value, ast.Constant):
                    return str(kw.value.value)
    return None


def policy_route_wired(path=ROOT / "agent" / "graph.py") -> bool:
    """Does policy_check end in `return Event(..., route=...)`."""
    try:
        tree = ast.parse(path.read_text())
    except (OSError, SyntaxError):
        return False
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == "policy_check":
            for sub in ast.walk(node):
                if isinstance(sub, ast.Return) and isinstance(sub.value, ast.Call):
                    fn = sub.value.func
                    name = fn.id if isinstance(fn, ast.Name) else getattr(fn, "attr", "")
                    if name == "Event" and any(kw.arg == "route" for kw in sub.value.keywords):
                        return True
    return False


@router.get("/stage3")
async def stage3():
    """Evidence for steps 5a and 5b: what stage3_router/agent.py defines and
    wires, and what its sessions show: routes taken, quarantine's tool calls,
    the cleaned direction, the script."""
    path = ROOT / "stage3_router" / "agent.py"
    edges = workflow_edges(path)
    tail = next((e for e in edges if e and e[0] == "join_research"), ())
    route_edge = next((e for e in edges if e and e[0] == "policy_check" and len(e) > 1 and e[1].startswith("route:")), ())
    scripter_call = _assigned_call(path, "scripter")
    quarantine_call = _assigned_call(path, "quarantine")
    quarantine_mode = _mode_kw(path, "quarantine")
    if quarantine_call == "def":
        quarantine_kind = "function"
    elif quarantine_call in ("Agent", "LlmAgent"):
        quarantine_kind = "task agent" if quarantine_mode == "task" else f"agent ({quarantine_mode or 'single_turn'})"
    else:
        quarantine_kind = None

    sessions = await _sessions("stage3_router")
    nodes: list[str] = []
    routes: list[str] = []
    tool_calls: dict[str, int] = {}
    cleaned: dict | None = None
    blocked_message = ""
    script_title = ""
    for _, sess in sessions:
        for ev in sess.events:
            name = _node_name(ev)
            if name and name != "stage3_router" and name not in nodes:
                nodes.append(name)
            route = getattr(getattr(ev, "actions", None), "route", None)
            if name == "policy_check" and route:
                routes.append(route)
            if name == "quarantine":
                for f in ev.get_function_calls() or []:
                    tool_calls[f.name] = tool_calls.get(f.name, 0) + 1
                out = getattr(ev, "output", None)
                if isinstance(out, dict) and out.get("title"):
                    cleaned = {k: out.get(k, "") for k in ("title", "angle", "hook")}
                for text in _texts(ev):
                    if "blocked" in text.lower():
                        blocked_message = text[:200]
            if name == "scripter":
                for text in _texts(ev):
                    try:
                        script_title = json.loads(text).get("title", "") or script_title
                    except (ValueError, AttributeError):
                        continue
    return {
        "edges": [list(e) for e in edges],
        "chain": list(tail),
        "router_wired": bool(tail) and tail[-1] == "policy_check",
        "routes_wired": bool(route_edge) and "OK" in route_edge[1] and "BLOCK" in route_edge[1],
        "reroute_wired": any(tuple(e[:2]) == ("quarantine", "scripter") for e in edges),
        "scripter_defined": scripter_call in ("Agent", "LlmAgent"),
        "policy_route_wired": policy_route_wired(),
        "quarantine_kind": quarantine_kind,
        "sessions": len(sessions),
        "nodes_ran": nodes,
        "routes": routes,
        "ok_runs": routes.count("OK"),
        "block_runs": routes.count("BLOCK"),
        "tool_calls": tool_calls,
        "cleaned": cleaned,
        "blocked_message": blocked_message,
        "script_title": script_title,
    }


@router.post("/stop-adk")
async def stop_adk():
    """Step 3c wrap-up. Stops every driver this server started and any
    standalone ADK process the student launched from a terminal (`adk web`,
    `adk api_server`). The dev UI mounted in this server is not a separate
    process; the page hides it instead."""
    drivers = await workers.stop_all()
    stopped: list[str] = []
    out = subprocess.run(["pgrep", "-fl", "adk (web|api_server)"], capture_output=True, text=True)
    for line in out.stdout.splitlines():
        pid_s, _, cmd = line.partition(" ")
        pid = int(pid_s)
        if pid == os.getpid():
            continue
        try:
            os.kill(pid, signal.SIGTERM)
            stopped.append(f"{pid} {cmd.strip()}")
        except OSError:
            pass
    return {"drivers_stopped": drivers, "adk_processes_stopped": stopped}
