"""`python -m agent.finish` - deliver the remaining results, then publish:
the machine result (the render) and the human thumb approval (auto-approved
here, loudly - Studio's button runs this same module). When the join
completes: gates, then publish.

A render Veo rejects is resubmitted through the same desk call path, up to
videogen.RETRIES times. A render that never finishes inside the window is
recorded as failed; the lap still publishes, with a manifest in place of a
video, so nothing is left hanging."""
import time

from . import drive, joinlogic, state, videogen
from .desk import thumb_desk


def main():
    st = state.load()
    sid = joinlogic.desk_sid(st)
    t0 = time.time()

    for cid, name, resp in drive.run(drive.pending(f"{st['run_id']}_thumb")):
        print("── human approval: thumbnail — AUTO-APPROVED [workshop mode] ──")
        drive.run(drive.answer(thumb_desk, f"{st['run_id']}_thumb", cid, name,
                               {"status": "approved", "kind": "thumb"}))
        st = state.load()
        st["lineage"]["approvals"].append({"kind": "thumb", "at": time.time()})
        state.save(st)

    budget = videogen.TIMEOUT_S * videogen.RETRIES + 30
    while time.time() - t0 < budget:
        for cid, name, resp in drive.run(drive.pending(sid)):
            op = resp.get("operation")
            if not op:
                continue
            status = videogen.check(op)
            if not status["done"]:
                continue
            if "error" in status:
                joinlogic.handle_failed(cid, name, resp, status)
            else:
                joinlogic.handle_done(cid, name, resp, status)
        if joinlogic.try_finish() is not None:
            return
        time.sleep(3.0 if state.load().get("render", {}).get("status") == "pending" else 1.0)

    # the window closed with the render still out: record it, finish the lap
    for cid, name, resp in drive.run(drive.pending(sid)):
        joinlogic.handle_failed(cid, name, resp, {"error": f"no result after {int(budget)}s"}, final=True)
    if joinlogic.try_finish() is not None:
        return
    print("finish window elapsed; run `python -m agent.status` to inspect")


if __name__ == "__main__":
    main()
