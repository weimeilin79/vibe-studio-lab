"""The desk - where the WORLD's waits live. Plain agents + LongRunningFunctionTool:
the graph never waits for a render (resume would re-submit); these sessions do.
The join is the driver's to count, never the model's."""
from google.adk import Agent
from google.adk.tools import LongRunningFunctionTool

from . import config


def render_submit(prompt: str) -> dict:
    """Submit the video render to Veo. Returns at once; the result arrives later."""
    from . import videogen
    receipt = videogen.start(prompt)
    return {"status": "pending", "operation": receipt["operation"], "prompt": prompt}


def request_thumb_approval(thumb_ref: str) -> dict:
    """Show the generated thumbnail to the human. The answer arrives later."""
    return {"status": "pending", "kind": "thumb", "thumb_ref": thumb_ref}


render_desk = Agent(
    name="render_desk", model=config.MODEL,
    tools=[LongRunningFunctionTool(render_submit)],
    instruction=(
        "You are the studio desk. Given a video prompt, call render_submit exactly "
        "once with it. While the call is pending, reply exactly WAITING. When it "
        "returns status 'done', reply with ONLY the url. When it returns status "
        "'failed', reply exactly FAILED."))

thumb_desk = Agent(
    name="thumb_desk", model=config.MODEL,
    tools=[LongRunningFunctionTool(request_thumb_approval)],
    instruction=("Call request_thumb_approval exactly once with the thumb_ref you were "
                 "given. When it returns status 'approved' or 'rejected', reply with "
                 "ONLY that word in caps."))
