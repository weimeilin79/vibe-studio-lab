"""`python -m agent.premiere` - put your published video on the ROOM's platform.

The local Wall is your analytics engine; the room's VibeTube is where
everyone's videos meet. Same lesson as the publish step, different host: publishing
is ONE multipart POST to a contract - no SDK, no session, just HTTP.

Needs (from your instructor, in .env):
  VIBETUBE_URL    the platform, e.g. https://<service>.run.app
  VIBETUBE_EVENT  the showroom code for this session
  VIBETUBE_NAME   how the room should credit you (optional)
"""
import os
import pathlib

import httpx

from . import config, state

def _room() -> tuple[str, str, str]:
    """Read the room's address at CALL time, so a .env filled during Setup
    is honored no matter which process asks."""
    return (os.environ.get("VIBETUBE_URL", "").rstrip("/"),
            os.environ.get("VIBETUBE_EVENT", "").strip(),
            os.environ.get("VIBETUBE_NAME", "").strip() or "Vibe Studio creator")


def package(st) -> pathlib.Path:
    """The file the room gets: the Veo clip the desk rendered."""
    ref = (st.get("render") or {}).get("url") or ""
    path = config.ROOT / "app" / ref.lstrip("/") if ref else None
    if not path or not path.exists():
        raise RuntimeError("no rendered video to post (prebaked run, or the render failed)")
    return path


def publish_to_room(st) -> dict:
    """The silent path Finish runs after every wall publish. Returns
    {'url': …} on success or {'skipped': reason} otherwise - it NEVER
    raises, because a room failure must never fail the lap."""
    url, event, name = _room()
    if not url or not event:
        return {"skipped": "no room configured"}
    pub = st.get("published")
    if not pub:
        return {"skipped": "nothing published yet"}
    try:
        cut = package(st)
        mins, secs = divmod(round(st.get("duration_ms", 6000) / 1000), 60)

        files = {"videoFile": (cut.name, cut.open("rb"), "video/mp4")}
        thumb = (st.get("thumb") or {}).get("ref", "")
        thumb_file = config.ROOT / "app" / thumb.lstrip("/") if thumb else None
        if thumb_file and thumb_file.exists():
            files["thumbnailFile"] = (thumb_file.name, thumb_file.open("rb"),
                                      "image/png")

        r = httpx.post(
            f"{url}/api/events/{event}/videos",
            data={"title": st["script"]["title"],
                  "description": st["script"]["description"],
                  "duration": f"{mins}:{secs:02d}",
                  "displayName": name,
                  "projectId": pub["video_id"]},
            files=files, timeout=120)
        if r.status_code != 200:
            try:
                detail = r.json().get("detail", r.text[:120])
            except Exception:
                detail = r.text[:120]
            return {"skipped": f"{r.status_code} — {detail}"}
        vid = r.json()["id"]
        return {"url": f"{url}/e/{event}?v={vid}"}
    except Exception as e:  # no clip, network down, anything
        return {"skipped": str(e)[:120]}


def main():
    """The loud back-door: re-post the current lap by hand."""
    url, event, _ = _room()
    if not url or not event:
        print("no room configured - set VIBETUBE_URL and VIBETUBE_EVENT in .env"
              "\n(your instructor has both; without a live event this step is"
              " optional - nothing later depends on it)")
        return
    st = state.load()
    if not st.get("published"):
        print("nothing published yet - finish a lap first"); return
    print(f"── POST {url}/api/events/{event}/videos ──")
    res = publish_to_room(st)
    state.update(room=res)
    if res.get("url"):
        print("── the room can see you now ──")
        print(f"  watch it with everyone else: {res['url']}")
    else:
        print(f"room: skipped ({res.get('skipped')})")


if __name__ == "__main__":
    main()
