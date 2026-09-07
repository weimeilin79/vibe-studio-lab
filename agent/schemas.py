"""Typed contracts between nodes - the workflow passes OBJECTS, not vibes."""
from pydantic import BaseModel, Field


class Evidence(BaseModel):
    claim: str
    source: str          # "trends" | "memory#<id>" | "graph#<n>" | "backcatalog"


class Brief(BaseModel):
    topic: str
    angle: str
    evidence: list[Evidence]


class Direction(BaseModel):
    title: str           # <=60 chars, filmable, characterful
    angle: str           # the twist, one line
    hook: str = ""       # 2-4 words printed as the thumbnail's sticker
    evidence: list[Evidence]


class Directions(BaseModel):
    candidates: list[Direction]   # exactly 4: three publishable, the fourth off-policy on purpose


class CleanedDirection(BaseModel):
    """What quarantine hands to finish_task: the three fields the
    scripter reads, with every refused word replaced."""
    title: str
    angle: str
    hook: str = ""


class Shot(BaseModel):
    description: str


class Script(BaseModel):
    title: str
    description: str
    tags: list[str]
    opening_line: str
    conclusion_first: bool   # true ONLY if opening_line states the outcome outright
    shots: list[Shot]



def direction_schema(n_candidates: int) -> dict:
    """The form the graph raises at the human door: one field, `pick`, with
    the real candidate count baked into its enum. NOTHING is `required`, on
    purpose: ADK re-validates a STORED answer against this schema on every
    resume, and a required field that arrived as null would make the session
    unresumable. persist_direction() resolves a blank pick to candidate 1."""
    picks = [str(i + 1) for i in range(n_candidates)]
    return {
        "type": "object",
        "properties": {
            "pick": {"type": "string", "enum": picks, "default": "1",
                     "description": f"1..{n_candidates} chooses a candidate; blank means 1."},
        },
        "required": [],
    }
