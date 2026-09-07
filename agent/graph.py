"""THE workflow - an idea in, a policy-cleared direction out, one human door.

  trends + backlog + feedback -> join -> propose_directions (4 candidates)
                          -> direction_gate (pick 1-4)
                          -> persist_direction -> policy_check (OK/BLOCK)
                          -> scripter -> render_desk -> store_video   |   quarantine -> scripter
                          -> render_desk (Veo, a long-running tool) -> store_video

The graph pauses for PEOPLE (the form) and refuses with a ROUTER (the policy)
BEFORE any money is spent. Memory (step 6) is not a node: it is two callbacks
on the agents, in agent/platform/memory.py.
"""
import json
import pathlib
import re

from google.adk import Agent, Event, Workflow
from google.adk.events.request_input import RequestInput
from google.adk.workflow import START, JoinNode

from .platform import config, state
from .cleanup_tools import find_policy_hits, suggest_replacement
from .desk import render_desk
from .schemas import CleanedDirection, Directions, Script


# ── research fan-out (pure compute + reads; it grows chapter by chapter) ────
def scan_trends(node_input):
    from .trends import sample_trends
    return Event(output={"trends": sample_trends()})


BACKLOG_FILE = pathlib.Path(__file__).parent / "backlog.txt"


def backlog_notes() -> list[str]:
    """The creator's backlog: one idea per line, comments skipped."""
    return [l.strip() for l in BACKLOG_FILE.read_text().splitlines()
            if l.strip() and not l.startswith("#")]


def idea_text(node_input) -> str:
    """Tonight's idea: the text of the message that started the run."""
    parts = getattr(node_input, "parts", None)
    if parts:
        return " ".join(p.text for p in parts if getattr(p, "text", None)).strip()
    if isinstance(node_input, str):
        return node_input.strip()
    return state.load().get("hint", "") or ""


def read_backlog(node_input):
    return Event(output={"backlog": backlog_notes(), "idea": idea_text(node_input)})


def read_feedback(node_input):
    """The third reader (step 7): what the audience wrote under past videos,
    the passages nearest to tonight's idea. Retrieval, not a model call."""
    from .platform import rag
    idea = idea_text(node_input)
    query = idea or "what viewers liked and what they complained about"
    try:
        hits = rag.retrieve(query)
    except Exception as e:
        print(f"  [rag] feedback unavailable ({str(e)[:80]})")
        return Event(output={"query": query, "feedback": [],
                             "note": "no corpus connected - run: python -m agent.platform.rag"})
    return Event(output={"query": query, "feedback": [h["text"] for h in hits]})


join_research = JoinNode(name="join_research")



# ── the proposer · a workflow node, so it decides in ONE call ───────────────
PROPOSE_INSTRUCTION = (
    "You run the creator's short-video channel. The message you received is "
    "tonight's research bundle as JSON, one key per reader node: scan_trends "
    "holds ten trends right now, each a format paired with a look (a visual "
    "style), never a subject, each with a heat score; read_backlog "
    "holds the creator's own notes, ideas they want to make someday, and "
    "tonight's idea from the creator, which may be empty; read_feedback, when "
    "present, holds what the audience wrote under past videos, the passages "
    "nearest to tonight's idea.\n"
    "Work like this. If the creator gave an idea tonight, that idea is the "
    "brief and candidates 1 to 3 are three versions of IT: the same subject "
    "and the same premise in every one, the creator's own nouns kept, never "
    "replaced by a trend or a backlog note. The research adds elements to the "
    "idea, it never overwrites it: a trend lends its format and its look, and "
    "a backlog note lends a detail or a setting. Say in the angle which trend "
    "and which note each candidate borrowed. Only when there "
    "is no idea tonight do you build from the backlog: merge the notes that "
    "fit together best, then find the trending topic each merged idea can "
    "ride, preferring higher heat. Either way a candidate is one filmable "
    "scene. If there is feedback, let it steer candidates 1 to 3: lean into "
    "what viewers praised, avoid what they complained about, and name the "
    "comment in the angle.\n"
    "PITCH exactly FOUR candidate directions for the next <=20s video. Each "
    "candidate: a title (<=60 chars, a concrete filmable characterful scene - "
    "never a meta content-strategy topic), an angle (the twist, one line), and "
    "a hook: 2-4 punchy Title Case words, the video's sticker line "
    "- the feeling of the moment, no punctuation, no emoji, and a style: the "
    "look of the clip in one line, taken from the trend the candidate rides "
    "(its text after 'look:'), so the four candidates differ in look as well "
    "as in twist.\n"
    "Candidates 1 to 3 are publishable and each cites at least one backlog note "
    "and one trend.\n"
    "Candidate 4 is the outrage-bait direction the channel must never publish, "
    "pitched the way a rival channel would. Its title MUST contain at least one "
    "of these words, spelled exactly: competitor, scam, revenge, humiliate, "
    "fake, dangerous stunt. Its hook is provocative too. It exists so the "
    "policy gate has something to refuse.\n"
    "Every evidence entry must cite a REAL source: 'trends', 'backlog', "
    "'feedback', or 'memory' (only when a MEMORY section is present). Empty or "
    "absent sections are never cited - never invent evidence.\n"
    "If the MEMORY section contains CHANNEL_RULES, candidates 1 to 3 MUST "
    "honor them.")

propose_directions = Agent(
    name="propose_directions",
    model=config.MODEL,
    instruction=PROPOSE_INSTRUCTION,
    output_schema=Directions)


# ── the human door · pick a direction (RequestInput: one small form) ────────
def direction_gate(node_input: Directions):
    cands = [c.model_dump() for c in node_input.candidates]
    yield Event(state={"candidates": cands})
    yield RequestInput(
        message="Pick tonight's direction: 1, 2, 3 or 4.",
        response_schema={
            "type": "object",
            "properties": {
                "pick": {"type": "string", "enum": ["1", "2", "3", "4"]}}},
        payload={"candidates": cands})


def persist_direction(node_input, candidates: list = []):
    """Resolve the human's pick into THE direction, and write it to shared state.

    `candidates` is not passed by anyone: ADK binds it from shared state
    because the parameter name matches a state key. The pick comes
    in as node_input, the gate's answer. A human door must degrade to a
    sensible choice, never raise: a null, missing, blank, or out-of-range pick
    resolves to candidate 1."""
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
                       "hook": hook, "user:prefs": {"last_direction": chosen["title"]}})
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
    lin = st.setdefault("lineage", {"evidence": [], "gates": {}})
    lin.setdefault("gates", {})["policy"] = {"ok": not bad, "hits": bad}
    state.save(st)
    return Event(output=node_input, route="BLOCK" if bad else "OK")




# ── pure production: script the cleared direction (runs quietly) ────────────
SCRIPT_INSTRUCTION = (
    "Write the production script for the approved video direction. The message "
    "you received is the direction as JSON: title, angle, hook, style.\n"
    "Deliver: title (<=60 chars, honoring the direction), description "
    "(1-2 sentences), 3-5 tags, an opening_line, EXACTLY 3 shots (each one "
    "visual sentence for a render model, written in the direction's style), "
    "and style: the direction's style, copied through, or a fitting look of "
    "your own if the direction has none.\n"
    "Set conclusion_first=true only when the opening_line states the final "
    "outcome outright, never for a teaser or a question.")

scripter = Agent(
    name="scripter",
    model=config.MODEL,
    instruction=SCRIPT_INSTRUCTION,
    output_schema=Script)

# the quarantine node of step 5c: a task-mode agent, assembled by the student
# in stage3_router/agent.py from this instruction and agent/cleanup_tools.py
QUARANTINE_INSTRUCTION = (
    "The channel's policy refused the direction you received. The message is "
    "the direction as JSON: title, angle, hook, style. Make it publishable without "
    "changing the scene.\n"
    "1. Call find_policy_hits with the title, and again with the angle, to "
    "learn which words are refused.\n"
    "2. For every refused word call suggest_replacement and rewrite the text "
    "with the suggestion (or a gentle synonym if none is listed).\n"
    "3. Call find_policy_hits again on the rewritten title and angle. Repeat "
    "steps 2 and 3 until both come back clean.\n"
    "4. Only then call finish_task with the cleaned title, angle and hook, "
    "and the style unchanged.")

quarantine = Agent(
    name="quarantine",
    model=config.MODEL,
    mode="task",
    instruction=QUARANTINE_INSTRUCTION,
    tools=[find_policy_hits, suggest_replacement],
    output_schema=CleanedDirection)


def store_video(node_input):
    """After the desk (step 8): the delivered render, from runs/state.json
    where deliver wrote it, into shared state and the run's output."""
    render = state.load().get("render") or {}
    url = render.get("url") or ""
    status = render.get("status", "")
    if not render:
        # nothing was delivered: the run never paused at render_desk, which
        # happens when render_submit is a plain tool, not a LongRunningFunctionTool
        status = "not delivered"
        said = ("no render was delivered: the run did not pause at render_desk. "
                "Is render_submit wrapped in LongRunningFunctionTool? (step 8a, edit 1)")
    elif status == "done":
        said = url or "prebaked stand-in, no file"
    else:
        said = f"failed: {render.get('reason', '')}"
    yield Event(output={"status": status, "url": url, "operation": render.get("operation", "")},
                state={"render_url": url, "render_status": status},
                message=f"video: {said}")


wf = Workflow(
    name="lap",
    description="research (trends, backlog, feedback) -> the human door -> the policy gate -> script",
    edges=[
        (START, scan_trends, join_research),
        (START, read_backlog, join_research),
        (START, read_feedback, join_research),
        (join_research, propose_directions, direction_gate,
         persist_direction, policy_check),
        (policy_check, {"OK": scripter, "BLOCK": quarantine}),
        (quarantine, scripter),
        (scripter, render_desk, store_video),
    ])
# NOTE: while the EDGES hole is open, wf has no edges. Importing this module
# stays legal (the stage apps borrow its nodes); only RUNNING a lap trips the
# guard - see lap.start_lap.
