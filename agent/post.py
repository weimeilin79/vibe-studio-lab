"""Post-production workflow - the publish BACKSTOP (pure compute + one gate).
editor -> eval_gate(PASS/FAIL) -> publisher.
The POLICY gate already ran inside the lap graph, before any money was
spent; this eval guards what the (quiet) script stage introduced - invented
evidence, an over-long title - right BEFORE the side effect."""
import time

from google.adk import Event, Runner, Workflow
from google.adk.workflow import START
from google.genai import types as gtypes

from . import config, drive, state

def editor(node_input):
    """Pick up the film: the one Veo clip the desk rendered. That file is what
    plays on the Channel wall and in the room. With no clip (a prebaked run,
    or a render that failed) the wall gets an honest manifest, not a fake mp4."""
    st = state.load()
    render = st.get("render") or {}
    final_ref = render.get("url")
    if not final_ref:
        final_ref = f"runs/final_{st['run_id']}.txt"
        (config.ROOT / final_ref).write_text(
            f"NO VIDEO ({render.get('status', 'none')}: {render.get('reason', 'prebaked run')})\n"
            f"prompt: {render.get('prompt', '')}\n")
    st.setdefault("duration_ms", render.get("duration_ms") or 8000)
    state.save(st)
    return Event(output={"final_ref": final_ref, "rendered": bool(render.get("url"))})


def eval_gate(node_input):
    """Deterministic conduct checks - a checker eval needs no golden answer."""
    st = state.load()
    s, lin = st["script"], st["lineage"]
    valid_sources = {"trends", "backcatalog"}
    valid_sources |= {f"memory#{m['ref']}" for m in st.get("memory_facts", [])
                      if m.get("ref")}
    valid_sources |= {f"graph#{q}" for q in st.get("graph_query_ids", [])}
    invented = [e for e in lin["evidence"] if e["source"] not in valid_sources]
    checks = {
        "title_len_ok": len(s["title"]) <= 60,
        "has_tags": len(s.get("tags", [])) >= 2,
        "no_invented_evidence": not invented,
    }
    lin["gates"]["eval"] = {"checks": checks, "invented": invented}
    state.save(st)
    return Event(output=node_input, route="PASS" if all(checks.values()) else "FAIL")


def rejected(node_input):
    return Event(output={"published": False, "why": "eval FAIL"})


def publisher(node_input):
    """Publish IS a tool call - and the gates just ran BEFORE it."""
    from world import platform
    st = state.load()
    res = platform.publish(
        st["creds"], st["run_id"],
        title=st["script"]["title"], description=st["script"]["description"],
        duration_ms=st["duration_ms"], lap=st["lap"],
        video_ref=node_input["final_ref"],
        thumb_ref=(st.get("thumb") or {}).get("ref", ""),
        lineage=st["lineage"])
    st["published"] = {**res, "at": time.time()}
    state.save(st)
    return Event(output={"published": True, **res})


wf_post = Workflow(
    name="post", description="editor -> eval backstop -> publisher",
    edges=[(START, editor, eval_gate),
           (eval_gate, {"PASS": publisher, "FAIL": rejected})])


async def run_post(run_id: str) -> dict:
    runner = Runner(node=wf_post, app_name=config.APP,
                    session_service=drive.svc(), auto_create_session=True)
    final = None
    async for ev in runner.run_async(
            user_id=config.USER, session_id=f"{run_id}_post",
            new_message=gtypes.Content(role="user", parts=[gtypes.Part(text="ship it")])):
        out = getattr(ev, "output", None)
        if isinstance(out, dict) and "published" in out:
            final = out
    if final is None:
        raise RuntimeError("post workflow produced no result")
    return final
