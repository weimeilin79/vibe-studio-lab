"""Derive the run snapshot from durable artifacts.

Everything here is READ from runs/state.json, the worker
logs, and the ADK session store. Nothing is remembered in the process, so the
snapshot says the same thing after a server restart. This is the async
counterpart of the phase/stage logic the original Studio page used.
"""
from __future__ import annotations

import importlib
import json
import os
import shutil
import time

from agent import config, drive, state

from .schemas_bridge import RunSnapshot, StageRow, GraphView, GraphEdge
from .workers import workers

# ── the stage vocabulary ─────────────────────────────────────────────────────
STAGES = [
    ("research",  "Research",              "four feeds fan out and join into one bundle"),
    ("direction", "Your direction",        "the run is suspended on the form"),
    ("policy",    "Policy gate",           "OK or BLOCK, before any spend"),
    ("script",    "Script",                "title, description, three shot prompts"),
    ("render",    "Render",                "one Veo clip for the whole script, plus the thumbnail"),
    ("thumb",     "Your approval",         "the thumbnail review"),
    ("join",      "Join",                  "the render delivered, and your approval"),
    ("publish",   "Publish",               "eval gate, then the wall"),
    ("room",      "Room post",             "the shared VibeTube, if configured"),
]
VERB_STAGE = {"run": "research", "render": "render", "finish": "join", "auto": None}
PASS, NOW, FAIL, RETRY, DEGRADED, BLOCKED, SKIP, IDLE, STALL, WAIT = (
    "pass", "now", "fail", "retry", "degraded", "blocked", "skip", "idle", "stall", "wait")


def _json(path) -> dict:
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def _log_tail(verb: str, n: int = 6) -> list[str]:
    try:
        lines = (config.RUNS / f"{verb}_run.log").read_text(errors="replace").splitlines()
        return [l for l in lines if l.strip()][-n:]
    except OSError:
        return []


def _room_configured() -> bool:
    return bool(os.environ.get("VIBETUBE_URL", "").strip() and os.environ.get("VIBETUBE_EVENT", "").strip())


# ── phase (async port of agent.lap.where) ───────────────────────────────────
async def phase_of(st: dict, pend_wf: list) -> dict:
    if not st.get("run_id"):
        return {"phase": "idle"}
    if st.get("published"):
        return {"phase": "published"}
    if st.get("blocked") and not st.get("script"):
        return {"phase": "blocked"}
    if st.get("script"):
        return {"phase": "scripted"}
    for cid, name, resp in pend_wf:
        if name == "adk_request_input":
            return {"phase": "form", "call": [cid, name], "message": resp.get("message"),
                    "payload": resp.get("payload")}
    return {"phase": "proposal"}


# ── stages ──────────────────────────────────────────────────────────────────
def _blame(st: dict, done: dict, last: dict | None) -> tuple[str, str] | None:
    if not last or not last.get("code"):
        return None
    verb = last.get("verb", "")
    want = VERB_STAGE.get(verb, "__none__")
    if want == "__none__":
        return None
    target = want if (want and not done.get(want)) else next((k for k, _, _ in STAGES if not done.get(k)), None)
    if not target:
        return None
    tail = _log_tail(verb, 1)
    return target, f"python -m agent.{verb} exited {last['code']} · {tail[0] if tail else ''}".rstrip(" ·")


def stage_rows(st: dict, phase: str, busy_verb: str | None, pend_thumb: bool,
               last: dict | None) -> list[StageRow]:
    lin = st.get("lineage") or {}
    gates = lin.get("gates") or {}
    render = st.get("render") or {}
    room = st.get("room") or {}
    approved = any(a.get("kind") == "thumb" for a in (lin.get("approvals") or []))
    policy = gates.get("policy") or {}
    ev = gates.get("eval") or {}
    ev_failed = bool(ev) and not all((ev.get("checks") or {}).values())
    rendered = render.get("status") == "done"
    render_failed = render.get("status") == "failed"
    settled = rendered or render_failed
    done = {
        "research": bool(st.get("brief") or st.get("candidates")),
        "direction": bool(st.get("direction")),
        "policy": bool(policy),
        "script": bool(st.get("script")),
        "render": bool(render),
        "thumb": approved,
        "join": settled and approved,
        "publish": bool(st.get("published")),
        "room": bool(room),
    }
    blame = _blame(st, done, last)
    rows: list[StageRow] = []
    for key, label, sub in STAGES:
        status, note = IDLE, ""
        if key == "research":
            if done["research"]:
                status, note = PASS, f"{len(st.get('candidates') or [])} directions proposed"
            elif st.get("run_id"):
                status = NOW if (busy_verb == "run" or phase == "proposal") else STALL
                note = "readers fanning out"
        elif key == "direction":
            if done["direction"]:
                status, note = PASS, st.get("direction", "")
            elif phase == "form":
                status, note = WAIT, "suspended on the form: a row, not a process"
        elif key == "policy":
            if st.get("blocked"):
                status, note = BLOCKED, "BLOCK: " + ", ".join(st["blocked"].get("hits") or [])
            elif policy:
                status = PASS if policy.get("ok") else BLOCKED
                note = "OK" if policy.get("ok") else "BLOCK: " + ", ".join(policy.get("hits") or [])
        elif key == "script":
            if done["script"]:
                status, note = PASS, (st.get("script") or {}).get("title", "")
            elif done["policy"] and policy.get("ok"):
                status, note = NOW, "writing the script"
        elif key == "render":
            if render:
                attempt = int(render.get("attempt", 1))
                retry = f" · attempt {attempt}" if attempt > 1 else ""
                if rendered and render.get("prebaked"):
                    status, note = DEGRADED, "prebaked stand-in, not Veo (STUDIO_REAL_VIDEO=0)"
                elif rendered:
                    status, note = PASS, f"clip delivered{retry}"
                elif render_failed:
                    status, note = FAIL, f"render failed: {render.get('reason', '')}"[:120]
                else:
                    status = NOW if busy_verb in ("render", "finish", "auto") else STALL
                    note = f"rendering with Veo{retry}" + (f" · retrying after: {render.get('reason', '')}" if attempt > 1 else "")
            elif done["script"]:
                status, note = (NOW if busy_verb in ("render", "auto") else IDLE), "submitting the render"
        elif key == "thumb":
            if approved:
                status, note = PASS, "approved"
            elif pend_thumb or st.get("thumb"):
                status, note = WAIT, "approve it and the run finishes itself"
        elif key == "join":
            if done["join"]:
                status, note = PASS, "render delivered + approval" if rendered else "render failed + approval"
            elif render:
                status = NOW if busy_verb in ("finish", "auto") else (STALL if settled else IDLE)
                note = ("render in" if settled else "waiting on the render") + ("" if approved else " · waiting on the thumbnail")
        elif key == "publish":
            if st.get("published"):
                status, note = PASS, str((st.get("published") or {}).get("video_id", ""))
            elif ev_failed:
                bad = [k for k, v in (ev.get("checks") or {}).items() if not v]
                status, note = FAIL, "eval gate FAIL: " + ", ".join(bad)
            elif done["join"]:
                status, note = NOW, "editor → eval gate → publisher"
        elif key == "room":
            if room.get("url"):
                status, note = PASS, "posted to the room"
            elif room.get("skipped") == "no room configured" or not _room_configured():
                status, note = SKIP, "no room configured"
            elif room.get("skipped"):
                status, note = FAIL, "room post failed: " + str(room["skipped"])
            elif st.get("published"):
                status, note = NOW, "posting to the room"
        if blame and blame[0] == key and status in (NOW, IDLE, STALL):
            status, note = FAIL, blame[1]
        if note.strip().casefold() == sub.strip().casefold():
            note = ""
        rows.append(StageRow(key=key, label=label, sub=sub, status=status, note=note))
    return rows


# ── the live graph ──────────────────────────────────────────────────────────
_GRAPH_MTIME = 0.0
_GRAPH_MOD = None


def _wf():
    """agent.graph.wf as it is on disk right now; re-imported when the file
    changes so the map reflects an edge the student just uncommented."""
    global _GRAPH_MTIME, _GRAPH_MOD
    mtime = (config.ROOT / "agent" / "graph.py").stat().st_mtime
    if _GRAPH_MOD is None:
        import agent.graph as g
        _GRAPH_MOD = g
    elif mtime != _GRAPH_MTIME:
        _GRAPH_MOD = importlib.reload(_GRAPH_MOD)
    _GRAPH_MTIME = mtime
    return _GRAPH_MOD.wf


LAYOUT_ORDER = ["__START__", "scan_trends", "read_backcatalog", "read_graph", "read_memory",
                "join_research", "propose_directions", "direction_gate",
                "persist_direction", "policy_check", "quarantine", "scripter", "store_script"]


def graph_view(st: dict, phase: str) -> GraphView:
    try:
        wf = _wf()
        edges = [GraphEdge(**{"from": e.from_node.name, "to": e.to_node.name,
                              "route": getattr(e, "route", None)}) for e in wf.graph.edges]
    except Exception:
        edges = []
    past = phase in ("form", "blocked", "scripted", "published")
    researched = bool(st.get("graph_report") or st.get("candidates") or past)
    proposed = bool(st.get("candidates")) or past
    chose = bool(st.get("direction"))
    blocked = bool(st.get("blocked"))
    scripted = bool(st.get("script"))
    wired = {"__START__"} | {e.from_ for e in edges} | {e.to for e in edges}
    nodes = {}
    for n in LAYOUT_ORDER:
        if n not in wired:
            continue
        if n == "__START__":
            s = "done" if st.get("run_id") else "idle"
        elif n in ("scan_trends", "read_memory", "read_backcatalog", "read_graph"):
            s = "done" if researched else ("now" if st.get("run_id") else "idle")
        elif n == "join_research":
            s = "done" if proposed else ("now" if researched else "idle")
        elif n == "propose_directions":
            s = "done" if (proposed or chose) else ("now" if researched else "idle")
        elif n == "direction_gate":
            passed = chose or scripted or blocked or phase in ("scripted", "published")
            s = "done" if passed else ("you" if phase == "form" else "idle")
        elif n == "persist_direction":
            s = "done" if chose else "idle"
        elif n == "policy_check":
            s = "done" if (scripted or blocked) else ("now" if chose else "idle")
        elif n == "quarantine":
            s = "done" if blocked else "idle"
        else:
            s = "done" if scripted else ("now" if (chose and not blocked) else "idle")
        nodes[n] = s
    return GraphView(edges=edges, nodes=nodes)


# ── the snapshot ────────────────────────────────────────────────────────────
def _thumb_ready(ref: str) -> bool:
    if not ref or not ref.startswith("/static/"):
        return False
    p = config.ROOT / "app" / ref.lstrip("/")
    try:
        return p.is_file() and p.stat().st_size > 0
    except OSError:
        return False


async def snapshot() -> RunSnapshot:
    st = state.load()
    rid = st.get("run_id")
    pend_wf: list = []
    pend_thumb: list = []
    if rid and not st.get("published"):
        try:
            if not (st.get("script") or st.get("blocked")):
                pend_wf = await drive.pending(f"{rid}_wf")
            pend_thumb = await drive.pending(f"{rid}_thumb")
        except Exception:
            pass
    ph = await phase_of(st, pend_wf)
    phase = ph["phase"]
    busy = workers.busy()
    last = workers.last_exit()

    suggested = st.get("direction") or (st.get("prefs") or {}).get("last_direction", "") or ""
    if not suggested:
        try:
            prefs = (await drive.ensure_user_state("_ui_probe")).get("user:prefs") or {}
            suggested = prefs.get("last_direction", "")
        except Exception:
            suggested = ""

    thumb = st.get("thumb")
    if thumb:
        thumb = {**thumb, "ready": _thumb_ready(thumb.get("ref", ""))}

    return RunSnapshot(
        run_id=rid, lap=st.get("lap"), phase=phase, busy=busy,
        last_exit=last if last and "verb" in last else None,
        hint=st.get("hint", "") or "", suggested_idea=str(suggested),
        candidates=st.get("candidates") or (ph.get("payload") or {}).get("candidates") or [],
        direction=st.get("direction"), thumb=thumb, thumb_pending=bool(pend_thumb),
        published=st.get("published"), blocked=st.get("blocked"), room=st.get("room"),
        stages=stage_rows(st, phase, busy, bool(pend_thumb), last),
        graph=graph_view(st, phase), updated_at=time.time(),
    )
