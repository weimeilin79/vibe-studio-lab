"""videogen: one script in, one Veo video out.

    from agent import videogen
    result = videogen.generate(script)          # blocks until the mp4 is on disk
    result["path"]                               # app/static/renders/<operation>_<stamp>.mp4

The whole script goes into a single prompt: title, description, opening line,
and the shots as one continuous scene, plus the house style. Veo renders one
clip. Every network step retries with a configurable count and interval, and
a render that Veo reports as failed or filtered is resubmitted the same way.

Two smaller entry points exist for an ADK LongRunningFunctionTool, where the
agent's turn must not block on a render:

    receipt = videogen.start(script)            # {"operation": ..., "prompt": ...}
    status  = videogen.check(receipt["operation"])   # {"done": bool, "path": ...}

Configuration, all optional, from the environment:
    STUDIO_VEO_MODEL      veo-3.1-fast-generate-001 on Vertex, -preview on AI Studio
    STUDIO_VEO_LOCATION   region for Vertex (default us-central1)
    STUDIO_VIDEO_RETRIES  attempts per network step and per render (default 3)
    STUDIO_VIDEO_INTERVAL seconds between attempts (default 15)
    STUDIO_VIDEO_TIMEOUT  seconds to wait for one render before giving up (default 600)
    STUDIO_VIDEO_DIR      where mp4 files land (default app/static/renders, served at /static/renders)
    STUDIO_REAL_VIDEO=0   no Veo, no cost: the render "finishes" after a few seconds with no file

Run it by hand:
    python -m agent.videogen --script runs/state.json          # the lap's script
    python -m agent.videogen --prompt "a tiny robot folding a giant sock"
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import time
from typing import Any

from . import config

MODEL = os.environ.get("STUDIO_VEO_MODEL") or (
    "veo-3.1-fast-generate-001" if config.VERTEX else "veo-3.1-fast-generate-preview")
LOCATION = os.environ.get("STUDIO_VEO_LOCATION", "us-central1")
RETRIES = int(os.environ.get("STUDIO_VIDEO_RETRIES", "3"))
INTERVAL_S = float(os.environ.get("STUDIO_VIDEO_INTERVAL", "15"))
TIMEOUT_S = float(os.environ.get("STUDIO_VIDEO_TIMEOUT", "600"))
VIDEO_DIR = pathlib.Path(os.environ.get("STUDIO_VIDEO_DIR") or (config.ROOT / "app" / "static" / "renders"))
WEB_PREFIX = "/static/renders"
CLIP_MS = 8000                      # a Veo 3.1 clip is eight seconds
PREBAKED_S = 5.0                    # how long a stand-in "render" takes

STYLE = ("Cozy low-poly faceted 3D animation, warm pastel palette of cream, "
         "terracotta, sage green and sky blue, soft studio lighting, one "
         "continuous take, no on-screen text.")

_client = None


class VideoError(RuntimeError):
    """Raised when every attempt failed. The message says what Veo said."""


# ── prompt ──────────────────────────────────────────────────────────────────

def build_prompt(script: Any) -> str:
    """The whole script as one prompt. Accepts the Script model or its dict."""
    s = script.model_dump() if hasattr(script, "model_dump") else dict(script)
    shots = [sh.get("description", "") if isinstance(sh, dict) else str(sh) for sh in s.get("shots", [])]
    parts = [f"Title: {s.get('title', '')}."]
    if s.get("description"):
        parts.append(s["description"])
    if s.get("opening_line"):
        parts.append(f"It opens with: {s['opening_line']}")
    if shots:
        parts.append("The video, in order: " + " Then ".join(sh.rstrip(".") + "." for sh in shots))
    parts.append(STYLE)
    return " ".join(p.strip() for p in parts if p.strip())


# ── client ──────────────────────────────────────────────────────────────────

def client():
    """Vertex via ADC when STUDIO_VERTEX=1 (Veo is served from a region, not
    the global endpoint Gemini uses), otherwise an AI Studio key."""
    global _client
    if _client is None:
        from google import genai
        if config.VERTEX:
            _client = genai.Client(vertexai=True, project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
                                   location=LOCATION)
        else:
            _client = genai.Client()
    return _client


def _retry(step: str, fn, retries: int, interval_s: float):
    """Call fn() up to `retries` times, `interval_s` apart. Raises VideoError
    with the last message when every attempt failed."""
    last = ""
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 - every API error is a retry here
            global _client
            _client = None                       # a client built against a bad env stays bad
            last = f"{type(e).__name__}: {str(e)[:160]}"
            print(f"  [videogen] {step} attempt {attempt}/{retries} failed: {last}")
            if attempt < retries:
                time.sleep(interval_s)
    raise VideoError(f"{step} failed after {retries} attempts ({last})")


# ── the three network steps ─────────────────────────────────────────────────

def start(script: Any, *, retries: int = RETRIES, interval_s: float = INTERVAL_S) -> dict:
    """Submit one render. Returns at once with the operation name; that string
    is all a later process needs to find the work again."""
    from google.genai import types as gt
    prompt = build_prompt(script) if not isinstance(script, str) else script

    def submit():
        return client().models.generate_videos(
            model=MODEL, prompt=prompt,
            config=gt.GenerateVideosConfig(
                aspect_ratio="16:9", resolution="720p", number_of_videos=1,
                negative_prompt="text, subtitles, captions, watermark, logo"))

    if not config.REAL_VIDEO:
        return {"operation": f"prebaked:{int(time.time())}", "model": "prebaked", "prompt": prompt,
                "submitted_at": time.time()}
    op = _retry("submit", submit, retries, interval_s)
    return {"operation": op.name, "model": MODEL, "prompt": prompt, "submitted_at": time.time()}


def check(operation: str, *, retries: int = RETRIES, interval_s: float = INTERVAL_S) -> dict:
    """Ask Veo about one operation. {"done": False} while it renders;
    {"done": True, "path": ..., "url": ...} once the mp4 is on disk;
    {"done": True, "error": ...} when Veo refused or filtered the render."""
    if operation.startswith("prebaked:"):
        started = float(operation.split(":", 1)[1])
        if time.time() - started < PREBAKED_S:
            return {"done": False, "operation": operation}
        return {"done": True, "operation": operation, "path": None, "url": None,
                "prebaked": True, "duration_ms": CLIP_MS}
    from google.genai import types as gt
    op = _retry("check", lambda: client().operations.get(gt.GenerateVideosOperation(name=operation)),
                retries, interval_s)
    if not op.done:
        return {"done": False, "operation": operation}
    err = getattr(op, "error", None)
    resp = getattr(op, "response", None) or getattr(op, "result", None)
    vids = (getattr(resp, "generated_videos", None) or []) if resp else []
    if err or not vids:
        return {"done": True, "operation": operation,
                "error": str(err)[:200] if err else "the model returned no video (filtered or empty)"}
    video = vids[0].video
    data = getattr(video, "video_bytes", None)                  # Vertex hands the bytes back inline
    if not data:
        data = _retry("download", lambda: client().files.download(file=video), retries, interval_s)
    if not data:
        return {"done": True, "operation": operation, "error": "download returned nothing"}
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    path = VIDEO_DIR / f"{_slug(operation)}.mp4"
    path.write_bytes(data)
    return {"done": True, "operation": operation, "path": str(path), "url": web_ref(path),
            "bytes": len(data), "duration_ms": CLIP_MS}


def web_ref(path) -> str:
    """The URL the app serves a rendered file at."""
    return f"{WEB_PREFIX}/{pathlib.Path(path).name}"


def generate(script: Any, *, retries: int = RETRIES, interval_s: float = INTERVAL_S,
             timeout_s: float = TIMEOUT_S, poll_s: float = 10.0) -> dict:
    """Script in, mp4 out. Blocks. A render Veo reports as failed is
    resubmitted, up to `retries` renders in total."""
    last = ""
    for render in range(1, retries + 1):
        receipt = start(script, retries=retries, interval_s=interval_s)
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            status = check(receipt["operation"], retries=retries, interval_s=interval_s)
            if status["done"] and "error" not in status:
                status.update(model=MODEL, prompt=receipt["prompt"], renders=render,
                              seconds=round(time.time() - receipt["submitted_at"]))
                return status
            if status["done"]:
                last = status["error"]
                break
            time.sleep(poll_s)
        else:
            last = f"no result after {int(timeout_s)}s"
        print(f"  [videogen] render {render}/{retries} failed: {last}")
        if render < retries:
            time.sleep(interval_s)
    raise VideoError(f"render failed after {retries} attempts ({last})")


def _slug(operation: str) -> str:
    tail = operation.rsplit("/", 1)[-1]
    return re.sub(r"[^A-Za-z0-9_-]+", "-", tail)[:60] + f"_{int(time.time())}"


# ── command line ────────────────────────────────────────────────────────────

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--script", help="JSON file holding a Script, or runs/state.json (its 'script' key)")
    src.add_argument("--prompt", help="a raw prompt instead of a script")
    ap.add_argument("--retries", type=int, default=RETRIES)
    ap.add_argument("--interval", type=float, default=INTERVAL_S)
    ap.add_argument("--timeout", type=float, default=TIMEOUT_S)
    a = ap.parse_args(argv)
    if a.script:
        data = json.loads(pathlib.Path(a.script).read_text())
        script = data.get("script", data)
    else:
        script = a.prompt
    print(f"  [videogen] model {MODEL} · retries {a.retries} · interval {a.interval:g}s · out {VIDEO_DIR}")
    result = generate(script, retries=a.retries, interval_s=a.interval, timeout_s=a.timeout)
    print(json.dumps(result, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
