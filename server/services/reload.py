"""Make a save visible to the very next ADK run.

The mounted dev UI caches two things per app: the imported agent module and a
Runner built from it. With reload_agents=True, ADK's own file watcher evicts
both a moment after a file changes, but "a moment" is a few seconds on macOS
and a fast student can run before it fires. This module does the eviction
synchronously from the code API, so "saved" means "the next run uses this".
"""
from __future__ import annotations

import importlib
import sys

from agent.platform import config


class _Handle:
    server = None          # the DevServer instance, captured at construction


handle = _Handle()


def stage_apps() -> list[str]:
    return sorted(d.name for d in config.ROOT.iterdir()
                  if d.is_dir() and (d / "agent.py").exists() and not d.name.startswith((".", "_")))


def after_save(rel_path: str) -> list[str]:
    """Reload the edited production module (agent/graph.py) in place and drop
    every stage app from the dev UI's caches. Returns the apps evicted."""
    if rel_path.startswith("agent/") and rel_path.endswith(".py"):
        mod = sys.modules.get(rel_path[:-3].replace("/", "."))
        if mod is not None:
            importlib.reload(mod)       # same module object: run_state's handle stays valid
    srv = handle.server
    if srv is None:
        return []
    apps = stage_apps()
    for app in apps:
        srv.agent_loader.remove_agent_from_cache(app)   # drops stage_x.* from sys.modules too
        srv.runners_to_clean.add(app)                   # next run builds a fresh Runner
    return apps
