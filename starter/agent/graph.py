"""THE workflow - an idea in, a policy-cleared direction out, one human door.

  2 readers (more join later) -> join -> propose_directions (3 candidates -> state)
                              -> direction_gate (pick 1/2/3, or your own)
                              -> persist_direction -> policy_check (OK/BLOCK)
                              -> scripter -> store_script   |   quarantine

The graph pauses for PEOPLE (the form) and refuses with a ROUTER (the policy)
BEFORE any money is spent. It never waits for the WORLD - renders live in the
desk session (agent/desk.py), because resuming a graph re-runs nodes and
would re-submit side effects.

The research fan-out GROWS across the lab: read_graph joins in the BigQuery
chapter and read_memory in the Memory Bank chapter - each one is a single
edge you add, and the live map grows a node the moment you do.
"""
import json
import pathlib
import re

from google.adk import Agent, Event, Workflow
from google.adk.events.request_input import RequestInput
from google.adk.workflow import START, JoinNode

from . import config, state
from .schemas import Directions, Script


# ── research fan-out (pure compute + reads; it grows chapter by chapter) ────
def scan_trends(node_input):
    from world import platform
    return Event(output={"trends": platform.trends()})


def read_backcatalog(node_input):
    from world import platform
    creds = state.load().get("creds")
    vids = platform.outcomes(creds["creator_id"]) if creds else []
    slim = [{"title": v["title"], "lap": v["lap"], "avg_watch_pct": v["avg_watch_pct"],
             "median_drop_ms": v["median_drop_ms"], "dropped_pct": v["dropped_pct"]}
            for v in vids]
    return Event(output={"backcatalog": slim})


def read_graph(node_input):
    """The measuring instrument: readings; the graph exists before you do.
    Wired into the fan-out in the BigQuery chapter - one edge."""
    from bqgraph import queries
    report = queries.research_report()
    st = state.load()
    st["graph_query_ids"] = [q["id"].split("#")[1] for q in report.get("queries", [])
                             if q.get("rows")]
    st["graph_report"] = report
    state.save(st)
    return Event(output={"audience_graph": report})


def read_memory(node_input):
    """Fresh Memory Bank retrieve each run; records citable refs + constraints.
    Wired into the fan-out in the Memory Bank chapter - one edge."""
    from . import memory
    try:
        facts = memory.recall()
    except Exception as e:  # cloud hiccup -> honest empty, never a crash
        print(f"  [memory] unavailable ({str(e)[:60]}) -> empty")
        facts = []
    entries = [{"ref": f"memory#{m['id'][:8]}", "topic": m["topic"], "fact": m["fact"]}
               for m in facts]
    rules = " ".join(m["fact"] for m in facts if m["topic"] == "CHANNEL_CONSTRAINTS")
    st = state.load()
    st["memory_facts"] = [{"id": m["id"], "ref": m["id"][:8],
                           "topic": m["topic"], "fact": m["fact"]} for m in facts]
    state.save(st)
    yield Event(state={"constraints": rules or "(none yet)"})
    yield Event(output={"memory": entries})


join_research = JoinNode(name="join_research")



# ── the proposer · a workflow node, so it decides in ONE call ───────────────
PROPOSE_INSTRUCTION = (
    "You run the creator's short-video channel. The message you received is "
    "tonight's research bundle as JSON: one key per reader node (scan_trends, "
    "read_backcatalog, and in later steps read_memory and read_graph); the "
    "creator's idea (may be empty) rides with it.\n"
    "PITCH exactly FOUR candidate directions for the next <=20s video. Each "
    "candidate: a title (<=60 chars, a concrete filmable characterful scene - "
    "never a meta content-strategy topic), an angle (the twist, one line), and "
    "a hook: 2-4 punchy Title Case words printed as a sticker on the thumbnail "
    "- the feeling of the moment, no punctuation, no emoji.\n"
    "Candidates 1 to 3 are publishable directions grounded in the research.\n"
    "Candidate 4 is the outrage-bait direction the channel must never publish, "
    "pitched the way a rival channel would. Its title MUST contain at least one "
    "of these words, spelled exactly: competitor, scam, revenge, humiliate, "
    "fake, dangerous stunt. Its hook is provocative too. It exists so the "
    "policy gate has something to refuse.\n"
    "Every evidence entry must cite a REAL source: 'trends', 'backcatalog', "
    "'memory#<id>' (ids present in the memory section only), or 'graph#<n>' "
    "(query numbers present in the graph section only). Empty or absent "
    "sections are never cited - never invent evidence.\n"
    "If the memory section contains CHANNEL_CONSTRAINTS rules, candidates 1 to "
    "3 MUST honor them.")

propose_directions = Agent(
    name="propose_directions",
    model=config.MODEL,
    instruction=PROPOSE_INSTRUCTION,
    output_schema=Directions)


# ── the human door · pick a direction (RequestInput: one small form) ────────
def direction_gate(node_input: Directions):
    cands = [c.model_dump() for c in node_input.candidates]
    yield Event(state={"candidates": cands})
    st = state.load()
    st["candidates"] = cands                             # driver clipboard copy
    state.save(st)
    # TODO: GATE_INPUT - suspend the graph here: yield a RequestInput with a message,
    # a response_schema (the form: one field, pick) and payload={"candidates": cands}


def persist_direction(node_input, candidates: list = [], constraints: str = ""):
    """Resolve the human's pick into THE direction - and remember the taste.
    `candidates` arrives from shared STATE (nobody passes it); `user:` keys
    are per-user and cross-session, so the NEXT lap's idea box can suggest
    something like this one.

    A human door must degrade to a sensible choice, never raise: a null,
    missing, blank, or out-of-range pick resolves to candidate 1. (The
    schema's `required` is empty on purpose: ADK re-validates a STORED answer
    on every resume, and a required field that arrived as null would make
    the session unresumable.)"""
    ni = node_input if isinstance(node_input, dict) else {}
    raw = ni.get("pick")
    pick = str(raw).strip() if raw is not None else ""
    if candidates:
        i = int(pick) - 1 if pick.isdigit() else 0
        chosen = candidates[max(0, min(len(candidates) - 1, i))]
    else:
        chosen = {"title": "untitled", "angle": "", "evidence": []}
    hook = chosen.get("hook") or " ".join(chosen["title"].split()[:4])
    yield Event(state={"direction": chosen["title"], "angle": chosen.get("angle", ""),
                       "hook": hook, "constraints": constraints or "(none yet)",
                       "user:prefs": {"last_direction": chosen["title"],
                                      "idea": state.load().get("hint", "")}})
    st = state.load()
    st["brief"] = {"topic": chosen["title"], "angle": chosen.get("angle", ""),
                   "hook": hook, "evidence": chosen.get("evidence", [])}
    st["direction"] = chosen["title"]                    # driver clipboard copy
    st["hook"] = hook
    state.save(st)
    yield Event(output=chosen)


# ── the policy gate · a deterministic router, BEFORE any money is spent ─────
# Policy is DATA, not code: the words live in policy_words.txt beside this
# file, and policy_check reads them at DECISION time - edit the file, and
# the very next run enforces it. No restart, no redeploy.
POLICY_FILE = pathlib.Path(__file__).parent / "policy_words.txt"


def policy_words() -> list[str]:
    return [w.strip().lower() for w in POLICY_FILE.read_text().splitlines()
            if w.strip() and not w.strip().startswith("#")]


def policy_check(node_input):
    """One node, one decision: `route` names the edge to take next."""
    text = f"{node_input.get('title', '')} {node_input.get('angle', '')}".lower()
    bad = [w for w in policy_words() if re.search(rf"\b{re.escape(w)}\b", text)]
    st = state.load()
    lin = st.setdefault("lineage", {"evidence": [], "memory_refs": [], "graph_refs": [],
                                    "render": {}, "approvals": [], "gates": {}})
    lin.setdefault("gates", {})["policy"] = {"ok": not bad, "hits": bad}
    state.save(st)
    # TODO: POLICY_ROUTE - return an Event whose output is node_input and whose route is "BLOCK" if bad else "OK"


def quarantine(node_input):
    """The polite stop: your own policy refused this direction. The lap ends;
    start again with a different one - nothing was rendered, nothing was paid."""
    st = state.load()
    st["blocked"] = {"direction": node_input.get("title", ""),
                     "hits": st.get("lineage", {}).get("gates", {})
                               .get("policy", {}).get("hits", [])}
    state.save(st)
    return Event(output={"cleared": False, "why": "policy BLOCK"})


# ── pure production: script the cleared direction (runs quietly) ────────────
SCRIPT_INSTRUCTION = (
    "Write the production script for the approved video direction. The message "
    "you received is the direction as JSON: title, angle, hook.\n"
    "Channel constraints: {constraints}\n"
    "Deliver: title (<=60 chars, honoring the direction), description "
    "(1-2 sentences), 3-5 tags, an opening_line, and EXACTLY 3 shots (each "
    "one visual sentence for a render model, in cozy low-poly style).\n"
    "If constraints include a conclusion-first rule, opening_line must state "
    "the final outcome outright, and only then set conclusion_first=true. "
    "Never claim conclusion_first for a teaser or a question.")

scripter = Agent(
    name="scripter",
    model=config.MODEL,
    instruction=SCRIPT_INSTRUCTION,
    output_schema=Script)

# the quarantine node of step 5b: a task-mode agent, assembled by the student
# in stage3_router/agent.py from this instruction and agent/cleanup_tools.py
QUARANTINE_INSTRUCTION = (
    "The channel's policy refused the direction you received. The message is "
    "the direction as JSON: title, angle, hook. Make it publishable without "
    "changing the scene.\n"
    "1. Call find_policy_hits with the title, and again with the angle, to "
    "learn which words are refused.\n"
    "2. For every refused word call suggest_replacement and rewrite the text "
    "with the suggestion (or a gentle synonym if none is listed).\n"
    "3. Call find_policy_hits again on the rewritten title and angle. Repeat "
    "steps 2 and 3 until both come back clean.\n"
    "4. Only then call finish_task with the cleaned title, angle and hook.")


def store_script(node_input: Script):
    st = state.load()
    st["script"] = node_input.model_dump()
    st["duration_ms"] = 12000
    brief = st.get("brief", {})
    evidence = brief.get("evidence", [])
    # citations become lineage; graph citations carry their re-runnable rows
    report = {q["id"]: q for q in st.get("graph_report", {}).get("queries", [])}
    for e in evidence:
        if e["source"] in report:
            e["rows_snapshot"] = report[e["source"]]["rows"]
    # standalone runs (the stage apps) have no lap driver to scaffold the ledger
    lin = st.setdefault("lineage", {"evidence": [], "memory_refs": [], "graph_refs": [],
                                    "render": {}, "approvals": [], "gates": {}})
    lin["topic"] = brief.get("topic", node_input.title)
    lin["angle"] = brief.get("angle", "")
    lin["evidence"] = evidence
    lin["memory_refs"] = sorted({e["source"] for e in evidence
                                 if e["source"].startswith("memory#")})
    lin["graph_refs"] = sorted({e["source"] for e in evidence
                                if e["source"].startswith("graph#")})
    lin["hook"] = {"hook_at_ms": 0 if node_input.conclusion_first else 5000,
                   "conclusion_first": node_input.conclusion_first}
    state.save(st)
    print(f"  script: {node_input.title!r} · {len(node_input.shots)} shots"
          f" · evidence {len(evidence)}")
    yield Event(message="script ready", state={"script_title": node_input.title})


wf = Workflow(
    name="lap",
    description="research -> the human door -> the policy gate -> script",
    edges=[
        (START, scan_trends, join_research),
        (START, read_backcatalog, join_research),
        (join_research, propose_directions, direction_gate,
         persist_direction, policy_check),
        (policy_check, {"OK": scripter, "BLOCK": quarantine}),
        (scripter, store_script),
        # TODO: GRAPH_EDGE — delete me, uncomment below: the audience graph joins the fan-out (Codelab: the BigQuery step)
        # (START, read_graph, join_research),
        # TODO: MEMORY_EDGE — delete me, uncomment below: the channel's memory joins the fan-out (Codelab: the Memory Bank step)
        # (START, read_memory, join_research),
    ])
# NOTE: while the EDGES hole is open, wf has no edges. Importing this module
# stays legal (the stage apps borrow its nodes); only RUNNING a lap trips the
# guard - see lap.start_lap.
