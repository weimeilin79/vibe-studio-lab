"""`python -m agent.render` - hand the script to the desk: ONE render submit
(the machine wait), generate the thumbnail, ring the human for approval. Then
both are pending at once - see `python -m agent.status`."""
import time

from world import thumbstudio

from . import drive, state, videogen
from .desk import render_desk, thumb_desk


def main():
    st = state.load()
    if not st.get("script"):
        print("no script yet — finish the workflow first (agent.run)"); return
    run_id = st["run_id"]
    prompt = videogen.build_prompt(st["script"])

    print("── desk: submitting the video render ──")
    out = drive.run(drive.say(render_desk, f"{run_id}_desk", f"Render this video:\n{prompt}"))
    print(f"  desk: {out!r}")
    st = state.load()
    st["render"] = {"prompt": prompt, "status": "pending", "attempt": 1,
                    "submitted_at": time.time()}
    state.save(st)

    print("── thumbnail: generating from YOUR direction ──")
    thumb = thumbstudio.generate(run_id, st["script"]["title"], st.get("direction", ""),
                                 hook=st.get("hook", ""))
    state.update(thumb=thumb)
    print(f"  thumb: {thumb['ref']} · generated={thumb['generated']}")

    out = drive.run(drive.say(
        thumb_desk, f"{run_id}_thumb",
        f"Request approval for this thumbnail: {thumb['ref']}"))
    print(f"  thumb desk: {out!r}")
    print("⏸  1 machine wait + 1 human wait hang concurrently — and no process "
          "is alive. Deliver them: python -m agent.finish (or approve in Studio)")


if __name__ == "__main__":
    main()
