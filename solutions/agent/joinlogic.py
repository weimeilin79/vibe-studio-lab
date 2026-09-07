"""The driver-owned join. ADK delivers answers; counting "done" is YOURS:
no render pending AND the human approved the thumbnail -> post-production."""
from . import drive, post, state, videogen
from .desk import render_desk


def desk_sid(st) -> str:
    return f"{st['run_id']}_desk"


def handle_done(cid, name, resp, status) -> None:
    """The render landed: close the pending call by id, record the file."""
    print(f"── result delivered: {status['operation']} ──")
    st = state.load()
    drive.run(drive.answer(render_desk, desk_sid(st), cid, name,
                           {"status": "done", "url": status.get("url") or "(prebaked stand-in)"}))
    st = state.load()
    st.setdefault("render", {}).update(
        status="done", url=status.get("url"), path=status.get("path"),
        prebaked=bool(status.get("prebaked")), operation=status["operation"])
    st["duration_ms"] = status.get("duration_ms") or videogen.CLIP_MS
    state.save(st)


def handle_failed(cid, name, resp, status, final: bool = False) -> None:
    """Veo refused or filtered the render (or it never finished). Close the
    call, then resubmit through the desk unless the retries are spent."""
    reason = status.get("error", "failed")
    st = state.load()
    render = st.setdefault("render", {})
    attempt = int(render.get("attempt", 1))
    print(f"── render failed: {reason} (attempt {attempt}/{videogen.RETRIES}) ──")
    drive.run(drive.answer(render_desk, desk_sid(st), cid, name, {"status": "failed", "reason": reason}))
    if final or attempt >= videogen.RETRIES:
        render.update(status="failed", reason=reason)
        state.save(st)
        return
    render.update(status="pending", attempt=attempt + 1, reason=reason)
    state.save(st)
    out = drive.run(drive.say(render_desk, desk_sid(st),
                              f"That render failed ({reason}). Render this video again:\n{render['prompt']}"))
    print(f"  desk: {out!r}")


def try_finish() -> dict | None:
    """THE JOIN: no pending render AND the thumb approved -> post-production."""
    st = state.load()
    still = drive.run(drive.pending(desk_sid(st)))
    human_ok = any(a["kind"] == "thumb" for a in st["lineage"]["approvals"])
    if still:
        return None
    if not human_ok:
        print("render complete — waiting on HUMAN (thumbnail). "
              "Doorbell: python -m agent.approve  (or the Studio button)")
        return None
    render = st.get("render") or {}
    print(f"── join complete (render {render.get('status', '?')} + human) -> post-production ──")
    st["lineage"]["render"] = {k: render.get(k) for k in ("prompt", "status", "url", "attempt", "reason", "prebaked")
                               if render.get(k) is not None}
    state.save(st)
    result = drive.run(post.run_post(st["run_id"]))
    print(f"PUBLISHED: {result}")
    st = state.load()
    st["next_lap"] = st["lap"] + 1
    state.save(st)
    if result.get("published"):
        # the room, silently: if Setup pointed .env at one, the same press
        # posts there too - and a room failure can never fail the lap
        from . import premiere
        room = premiere.publish_to_room(state.load())
        state.update(room=room)
        if room.get("url"):
            print(f"  the room can see you: {room['url']}")
    return result
