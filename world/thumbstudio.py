"""The thumbnail studio - the video's thumbnail, in a consistent house style.

The prompt is built in layers so the studio's style never depends on what a
student types:

  ANCHOR      the chosen direction              <- the ONLY layer user text touches
  STYLE-LOCK  the studio's house style          <- fixed, every time
  CONSTRAINTS framing / no-text / output        <- fixed, every time

A thumbnail is art PLUS words. Image models garble text, so the words are
code's job: caption_sticker() prints a 2-4 word caption (the direction's hook,
written by the proposer agent) in the corner of the finished art.

generate() is the synchronous path the lap uses (agent/render.py): it turns
your chosen direction into the video's real thumbnail, then the desk holds a
pending request_thumb_approval call until you judge it in Vibe Studio.
"""
from agent import config

THUMBS = config.ROOT / "app" / "static" / "thumbs"
FALLBACK = "/static/art/thumb-chores.png"
MODEL = "gemini-3-pro-image"

STYLE_LOCK = (
    "Cozy low-poly faceted 3D art, Monument Valley register, warm pastel "
    "palette of cream, terracotta, sage green and sky blue, soft bright "
    "daylight, handmade miniature diorama feel.")
CONSTRAINTS = (
    "A YouTube thumbnail illustration in a WIDE 16:9 frame that the scene fills "
    "edge to edge - no borders, no side bars, no letterboxing, no vignette, no "
    "picture frame. One comic decisive moment, expressive, joyful disaster "
    "energy, the subject large and centered-right, the lower-left corner calm "
    "and uncluttered (a caption sticker goes there). No text, no words, no "
    "letters, no logos.")
FILL_THE_FRAME = (" IMPORTANT: the artwork must cover the whole wide canvas - "
                  "paint all the way to the left and right edges, never leave "
                  "empty bars.")


def draft_prompt(idea: str) -> str:
    """ANCHOR + STYLE-LOCK + CONSTRAINTS. User words slot in as DATA."""
    return f"A video thumbnail. The scene is: {idea}. {STYLE_LOCK} {CONSTRAINTS}"


def short(text: str, n: int = 4) -> str:
    """A caption when nobody wrote one: the first few words."""
    return " ".join(text.replace("—", " ").split()[:n])


# ── the caption sticker · a thumbnail is art PLUS words ────────────────────
# Image models garble long text, so the studio draws the art and then prints
# the caption itself - a chunky rounded display face (Lilita One, bundled,
# OFL) with a dark outline, tilted like a sticker, in the calm corner the
# prompt reserved for it.
FONTS = [
    str(config.ROOT / "app" / "static" / "fonts" / "LilitaOne-Regular.ttf"),   # bundled
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",                     # any Linux
    "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf",                # macOS
]
INK = (43, 35, 32)
PAPER = (255, 250, 244)


def _font(size: int):
    from PIL import ImageFont
    import pathlib as _p
    for f in FONTS:
        if _p.Path(f).exists():
            return ImageFont.truetype(f, size)
    return None                    # no font on this box: art without the caption


def _wrap(words, font, draw, max_w):
    lines, line = [], ""
    for w in words:
        trial = f"{line} {w}".strip()
        if draw.textlength(trial, font=font) <= max_w or not line:
            line = trial
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def caption_sticker(png, text: str) -> None:
    """Print the caption on the thumbnail, in place: white letters, dark
    outline, a soft shadow, a 3-degree tilt, bottom-left. Never fails a lap."""
    if not text:
        return
    try:
        from PIL import Image, ImageDraw
        img = Image.open(png).convert("RGBA")
        W, H = img.size
        words = text.strip().split()
        probe = ImageDraw.Draw(img)
        size = int(H * 0.17)
        while size > int(H * 0.08):           # shrink until it fits in two lines
            font = _font(size)
            if font is None:
                return
            lines = _wrap(words, font, probe, W * 0.62)
            if len(lines) <= 2:
                break
            size -= 2
        stroke = max(3, int(size * 0.10))
        lh = size * 1.02
        x0, y0 = int(W * 0.05), int(H - H * 0.075 - lh * len(lines))
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        for i, ln in enumerate(lines):
            y = y0 + i * lh
            d.text((x0 + size * 0.05, y + size * 0.07), ln, font=font,      # shadow
                   fill=(*INK, 110), stroke_width=stroke, stroke_fill=(*INK, 110))
            d.text((x0, y), ln, font=font, fill=(*PAPER, 255),             # letters
                   stroke_width=stroke, stroke_fill=(*INK, 255))
        layer = layer.rotate(3, resample=Image.BICUBIC,
                             center=(x0, y0 + lh * len(lines)))            # sticker tilt
        img.alpha_composite(layer)
        img.convert("RGB").save(png)
    except Exception as e:                     # never fail a lap over a font
        print(f"  [thumbstudio] caption skipped ({str(e)[:60]})")


# ── the frame guard · a wide canvas must be a wide picture ─────────────────
def _letterboxed(img) -> bool:
    """True when the model painted a narrow picture and padded the sides."""
    from PIL import ImageStat
    W, H = img.size
    band = max(8, int(W * 0.10))
    g = img.convert("L")
    left = ImageStat.Stat(g.crop((0, 0, band, H)))
    right = ImageStat.Stat(g.crop((W - band, 0, W, H)))
    return left.stddev[0] < 7 and right.stddev[0] < 7 and \
        abs(left.mean[0] - right.mean[0]) < 14


def _cover_crop(img):
    """Last resort: cut the padded bars away and re-fill the wide frame."""
    from PIL import Image, ImageStat
    W, H = img.size
    g = img.convert("L").resize((240, 60))
    cols = [ImageStat.Stat(g.crop((x, 0, x + 1, 60))).stddev[0] for x in range(240)]
    live = [x for x, s in enumerate(cols) if s > 8]
    if not live:
        return img
    x0, x1 = int(live[0] / 240 * W), int((live[-1] + 1) / 240 * W)
    content = img.crop((x0, 0, x1, H))
    scale = W / content.width
    grown = content.resize((W, int(H * scale)), Image.LANCZOS)
    top = (grown.height - H) // 2
    return grown.crop((0, top, W, top + H))


def _client():
    from google import genai
    return genai.Client()          # env decides: Vertex via ADC, or an AI Studio key


def _extract(response, out) -> bool:
    for part in response.candidates[0].content.parts:
        data = getattr(getattr(part, "inline_data", None), "data", None)
        if data:
            out.write_bytes(data)
            return True
    return False


def _cfg():
    from google.genai import types as gt
    return gt.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"],
                                    image_config=gt.ImageConfig(aspect_ratio="16:9"))


def _call(client, contents, out) -> bool:
    return _extract(client.models.generate_content(model=MODEL, contents=contents,
                                                   config=_cfg()), out)


def _wide(client, contents, out, retry_with=None) -> bool:
    """Generate, then guard the frame: a letterboxed result is drawn once more
    with the fill-the-frame line; if it still comes back padded, cover-crop."""
    from PIL import Image
    if not _call(client, contents, out):
        return False
    if _letterboxed(Image.open(out)):
        print("  [thumbstudio] letterboxed - asking for a full-width frame once more")
        if retry_with is not None and _call(client, retry_with, out) \
                and not _letterboxed(Image.open(out)):
            return True
        _cover_crop(Image.open(out).convert("RGB")).save(out)
    return True


def generate(run_id: str, title: str, direction: str, attempt: int = 0,
             hook: str = "") -> dict:
    """The LAP's synchronous path: the video's real thumbnail, from your
    chosen direction. The sticker text is the direction's `hook` (2-4 words
    the proposer wrote). Falls back to a prebaked thumb (honestly flagged) if
    the image model is unavailable."""
    import shutil
    THUMBS.mkdir(parents=True, exist_ok=True)
    suffix = f"_r{attempt}" if attempt else ""
    out = THUMBS / f"{run_id}{suffix}.png"
    words = hook.strip() or short(title, 5)
    try:
        client = _client()   # keep the reference: a temporary gets closed mid-call
        prompt = draft_prompt(direction or title)
        if not _wide(client, prompt, out, retry_with=prompt + FILL_THE_FRAME):
            raise RuntimeError("no image part in response")
        caption_sticker(out, words)          # art, then the words on top
        return {"ref": f"/static/thumbs/{out.name}", "generated": True}
    except Exception as e:
        print(f"  [thumbstudio] fell back to prebaked ({str(e)[:70]})")
        shutil.copyfile(config.ROOT / "app" / FALLBACK.lstrip("/"), out)
        caption_sticker(out, words)
        return {"ref": f"/static/thumbs/{out.name}", "generated": False}
