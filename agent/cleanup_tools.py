"""Tools for the quarantine node (step 5b).

The node is a task-mode agent: it calls these until find_policy_hits comes
back clean, then calls finish_task with the cleaned direction. Both tools are
plain functions; ADK reads the signature and the docstring to describe them
to the model.
"""
from __future__ import annotations

import re

from . import config
from .graph import policy_words

REPLACEMENTS_FILE = config.ROOT / "agent" / "policy_replacements.txt"


def find_policy_hits(text: str) -> dict:
    """Which refused words appear in `text`. Matches whole words and phrases
    from agent/policy_words.txt, case-insensitive.

    Returns {"hits": [...], "clean": bool}. clean is true when hits is empty.
    """
    low = text.lower()
    hits = [w for w in policy_words()
            if re.search(rf"\b{re.escape(w)}\b", low)]
    return {"hits": hits, "clean": not hits}


def _replacements() -> dict[str, str]:
    out = {}
    for line in REPLACEMENTS_FILE.read_text().splitlines():
        if "=>" in line and not line.strip().startswith("#"):
            bad, good = line.split("=>", 1)
            out[bad.strip().lower()] = good.strip()
    return out


def suggest_replacement(word: str) -> dict:
    """The channel's approved stand-in for a refused word, read from
    agent/policy_replacements.txt.

    Returns {"word", "replacement", "listed"}. When the word has no entry,
    listed is false and replacement is a hint to pick a synonym yourself.
    """
    table = _replacements()
    key = word.strip().lower()
    if key in table:
        return {"word": word, "replacement": table[key], "listed": True}
    return {"word": word, "listed": False,
            "replacement": "(no entry: pick a gentle synonym, keep the scene)"}
