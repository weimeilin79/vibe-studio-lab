"""The adk web entry: `adk web .` finds this because the folder name is the
app name and this file exports root_agent. The folder name matches
config.APP, so selecting `vibestudio` in adk web lists the lap's own sessions
(run_<id>_wf, run_<id>_desk) for inspection. The desk agent is the root."""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from agent.desk import render_desk  # noqa: E402

root_agent = render_desk
