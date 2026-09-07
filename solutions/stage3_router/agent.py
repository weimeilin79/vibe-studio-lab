"""Stage 3 - the policy gate and what comes after it.

Stage 2 plus the ROUTER: policy_check reads agent/policy_words.txt at
decision time and routes the chosen direction to OK or BLOCK, before any
script is written or any money is spent. OK goes to the scripter. BLOCK goes
to quarantine, which in step 5b becomes a task-mode agent that replaces the
refused words with its tools and hands the cleaned direction to the scripter.

scripter and quarantine are defined here, in the sandbox, so you write both
nodes yourself; the instructions and the tools they use live in agent/.
"""
from google.adk import Agent, Event, Workflow
from google.adk.workflow import START, JoinNode

from agent import config
from agent.cleanup_tools import find_policy_hits, suggest_replacement
from agent.graph import (PROPOSE_INSTRUCTION, QUARANTINE_INSTRUCTION,
                         SCRIPT_INSTRUCTION, direction_gate, persist_direction,
                         policy_check, read_backcatalog, scan_trends)
from agent.schemas import CleanedDirection, Directions, Script

join_research = JoinNode(name="join_research")

propose_directions = Agent(
    name="propose_directions",
    model=config.MODEL,
    instruction=PROPOSE_INSTRUCTION,
    output_schema=Directions)

scripter = Agent(
    name="scripter",
    model=config.MODEL,
    instruction=SCRIPT_INSTRUCTION,
    output_schema=Script)

quarantine = Agent(
    name="quarantine",
    model=config.MODEL,
    mode="task",
    instruction=QUARANTINE_INSTRUCTION,
    tools=[find_policy_hits, suggest_replacement],
    output_schema=CleanedDirection)

root_agent = Workflow(
    name="stage3_router",
    description="research -> you -> the policy gate -> a script",
    edges=[(START, scan_trends, join_research),
           (START, read_backcatalog, join_research),
           (join_research, propose_directions, direction_gate,
            persist_direction, policy_check),
           (policy_check, {"OK": scripter, "BLOCK": quarantine}),
           (quarantine, scripter)])
