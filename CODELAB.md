author: Annie Wang (cuppibla)
summary: Design agentic workflows as graphs with the Agent Development Kit (ADK): parallel nodes and joins, an agent as a node, RequestInput for human decisions, deterministic routers, and driver-owned join logic. Then add state and persistent memory: session state and the user: prefix, a BigQuery property graph, and Vertex AI Memory Bank, each wired into the graph as one edge.
id: vibestudio
categories: adk,agents,bigquery,memory-bank,gemini
environments: Web
status: Draft
feedback link: https://github.com/cuppibla/vibe-studio-lab/issues

# Long-Running Workflows and Durable State with ADK

## Introduction
Duration: 0:03:00

![The studio while a job is pending: the process is idle and the state is on disk](codelab-img/hero.gif)

This codelab covers agentic workflow design with the Agent Development Kit (ADK): how to structure a multi-step agent system as an explicit graph instead of a single prompt, and how to store that graph's state outside the process so a run survives restarts.

### The scenario

You run a channel on VibeTube. You have a backlog of video ideas and no time for the production work each one requires: researching what is trending, checking your back catalog, choosing a direction, writing the script, generating the thumbnail and the shots, reviewing the result, and publishing. Current generative models can perform each of those tasks.

The remaining problem is process. You want a pipeline that runs the routine steps on its own, asks you only for decisions that require your judgment, refuses a bad direction before it costs money, and carries what one video taught you into the next. A pipeline with those properties is repeatable and auditable, and you could hand it to another creator. That is the pipeline you build in this lab. The application it powers is called Vibe Studio.

### ADK constructs used

- `Workflow`, its edge list, `START`, and `JoinNode` for a parallel fan-out and join
- An `Agent` used as a workflow node in `single_turn` mode
- `RequestInput` to suspend the graph for a human decision, with a response schema that a frontend renders as a form
- Shared run state: nodes write with `Event(state=...)` and read through `parameter_binding='state'`
- A deterministic router node whose return value selects the outgoing edge
- `LongRunningFunctionTool`, the `pending` receipt, and resuming a call by id with a `function_response`
- `DatabaseSessionService`, session state, and the `user:` key prefix
- A BigQuery property graph (GQL `MATCH`) as a research node
- Vertex AI Memory Bank (`memories.generate` and `memories.retrieve`) as a research node

The diagram shows the graph you build. Each box is code you will read. The two greyed research nodes are connected in the final two steps, one edge each.

![The production pipeline](codelab-img/d10-productionline.png)

### Structure

| Part | Steps | What you do | What it covers |
|---|---|---|---|
| **1. Workflow graph design** | A single prompt, The research fan-out, The policy gate, Approve and publish | Run the pipeline as one prompt, rebuild it as a graph with a fan-out, a join, an agent node, a human input node, and a router, then run it as a product and publish a video | Why a graph replaces a prompt, `RequestInput`, deterministic routing, `LongRunningFunctionTool` and the `function_response` resume path, and join logic written in your driver |
| **2. State and persistent memory** | BigQuery graph, Session state, Memory Bank | Read persisted state before a run exists, then add two research nodes to the graph | The `user:` prefix, a property graph declared over BigQuery tables, and a managed Memory Bank read on every run |

Design rules applied throughout:

- Graphs pause for people, not for machines. A resumed graph re-runs its nodes, so external submissions live in a plain agent session and only human decisions suspend the graph.
- Every pause resumes with one `function_response` carrying the same call id as the original call.
- Nodes share state by key name. `candidates`, `direction`, and `user:prefs` move through the graph without being passed between nodes.
- Routing decisions are plain code. The policy gate is a function and a text file.
- Adding a research feed changes one line of the edge list.

## Setup
Duration: 0:09:00

![Vibe Studio architecture: frontend, backend, inspector, cloud](codelab-img/d5-architecture.png)

**Vibe Studio** (left) is the frontend. Each button runs one backend command. **Your backend** (middle) has two agents (the workflow and the render desk), plain Python drivers, and the `runs/` directory where pending calls and state keys are stored. **adk web** (bottom) is a read-only inspector over the same `sessions.db`. The **cloud** column holds the two long-lived stores: BigQuery and Memory Bank.

In this step you clone the repository, install dependencies, and run a preflight check. Each server is started in the step that first needs it.

### Roles

- `agent/` is the backend you read and edit.
- Vibe Studio (port 4600) is the frontend. Each button runs one backend command, and the caption under the button names that command.
- adk web (port 8000) is the inspector. It displays the raw events your backend writes.

### Install

Open the Cloud Shell terminal. This lab calls it **tab 1**. Run:

```console
git clone https://github.com/cuppibla/vibe-studio-lab
cd vibe-studio-lab
uv sync
source .venv/bin/activate
cp .env.example .env
python scripts/preflight.py
```

The output ends with `PREFLIGHT GREEN`. The line about Vibe Studio reports `not running yet` because a later step starts it.

```
  ✓ python 3.12
  ✓ greenlet (async sqlite)
  ✓ auth path A: Vertex via ADC (STUDIO_VERTEX=1)
  ✓ Google Cloud ADC (project <your-project>)
  ✓ Memory Bank SDK
  ✓ stage0_prompt loads
  ✓ stage1_fanout loads
  ✓ stage2_direction loads (6 edges)
  ✓ stage3_router loads (12 edges)
  - Vibe Studio: not running yet (started in the policy gate step)
  - room: not configured (local only — publishing still works)

PREFLIGHT GREEN
```

### Terminal tabs and browser previews

The lab uses three terminal tabs and two browser previews.

| Tab | Runs | Opened in |
|---|---|---|
| **tab 1** | Your working terminal: the install, six small edits, and the optional checks | Setup |
| **tab 2** | `adk web` on port 8000: raw events, the State tab, and the sandbox apps | The pipeline as a single prompt |
| **tab 3** | `uvicorn` on port 4600: Vibe Studio | The policy gate |

Each instruction names its surface:

| Surface | Meaning |
|---|---|
| **Terminal** | Type in a terminal. Tab 1 unless another tab is named |
| **adk web** | Click or type in the port 8000 preview |
| **Vibe Studio** | Click in the port 4600 preview |
| **Read** | Read the code shown in the codelab |
| **Edit** | Edit a file in the Cloud Shell Editor. This happens six times |

### Render cost

The render is real by default: each video is one Veo 3.1 clip, about eight seconds, which takes one to three minutes and costs a few dollars per run. To run without cost, or without video quota, set `STUDIO_REAL_VIDEO=0` in `.env`; the render then finishes after a few seconds with a stand-in and no file.

### Join a shared room (optional, live workshops only)

If an instructor provided platform values, add them to `.env` now. From the publish step onward, each finished video is also posted to the room's VibeTube, and your published card carries the watch link.

In **tab 1**, open `.env` in the Cloud Shell Editor:

```console
cloudshell edit ~/vibe-studio-lab/.env
```

Fill in the platform block. The third line is the name the room credits you under:

```
VIBETUBE_URL=https://<the-platform-url-your-instructor-gives>
VIBETUBE_EVENT=sandbox
VIBETUBE_NAME=Your Name
```

Self-paced with no instructor: skip this and leave the block commented out. Publishing works locally, and preflight prints `room: not configured (local only — publishing still works)`. After filling in the block, `python scripts/preflight.py` prints `✓ room: connected`.

### Reference (optional)

<aside class="positive">
<b>Repository layout.</b> <code>agent/</code> is the backend you read and edit. <code>vibestudio/</code> is the adk web entry point for the production app. <code>stage0_prompt/</code> through <code>stage3_router/</code> are the four sandbox apps used in the workflow steps. <code>server/</code> and <code>web/</code> are Vibe Studio, the app you run from <code>scripts/start.sh</code>. <code>world/</code> is the platform (the Wall API) and the thumbnail generator; <code>agent/videogen.py</code> talks to Veo. <code>bqgraph/</code> is the BigQuery step. <code>checks/</code> holds the verification checks.
</aside>

<aside class="positive">
<b>Verification checks.</b> <code>python -m checks.check &lt;name&gt;</code> runs about ten assertions against the real artifacts (sessions, state, the wall, BigQuery, the bank). Each step's reference section names its check. All checks are optional. Read any of them with <code>cloudshell edit ~/vibe-studio-lab/checks/check.py</code>.
</aside>

## The pipeline as a single prompt
Duration: 0:05:00

In this step you run the pipeline the simplest way: one agent, one instruction, two tools. You then examine what its output does and does not let you check. The next two steps rebuild the same pipeline as a workflow graph.

Choose a short video idea now. Name a scene in a few words, for example `a tiny robot doing laundry at midnight`. The idea is reused through the lab and becomes the published video.

### The pipeline

![The production pipeline: a graph for research, the world for renders, a backstop for publishing](codelab-img/d10-productionline.png)

The diagram has three bands.

- **Top band, the workflow graph.** Research fans out, joins, produces three candidate directions, pauses for your choice, passes a policy gate, and writes a script. The stages below build this band. The two greyed research nodes, the audience graph and the memory bank, are connected in the final two steps.
- **Middle band, the desk.** Renders and the thumbnail approval wait in a plain agent session, not in the graph.
- **Bottom band, the publish backstop.** A second, smaller workflow runs once before publishing.

### Start adk web

In a second terminal tab (**tab 2**), start the dev UI and leave it running for the rest of the lab:

```console
cd ~/vibe-studio-lab
source .venv/bin/activate
adk web . --port 8000 --allow_origins "*" --reload_agents --session_service_uri "sqlite+aiosqlite:///$PWD/runs/sessions.db"
```

Click **Web Preview → Change port → 8000**. adk web lists every folder that contains an `agent.py` exporting `root_agent`, using the folder name as the app name. The four `stage*` apps are the graph subsets used in this step and the next. `vibestudio` is the production app, used later to inspect the run's sessions.

The `--session_service_uri` flag points adk web at `runs/sessions.db`, the SQLite file the production app also writes. ADK reads and writes it through `DatabaseSessionService`. Every event, state key, and pending call in this lab is stored there.

### An ADK agent at a glance

ADK is Google's code-first framework for building agents in Python. An agent is a model plus the context it reasons with, the tools and collaborators it acts through, and callbacks that wrap each call. A typical definition names every piece:

```python
from google.adk.agents import LlmAgent
from google.adk.tools import mcp_toolset

root_agent = LlmAgent(
    model="gemini-3.5-flash",                 # model
    instruction=BRAND_INSTRUCTION,            # instruction
    skills=[load_skill("brand-audit")],       # skills
    tools=[mcp_toolset("mcp_brand_style")],   # tools
    output_schema=BrandStyleReport,
    before_agent_callback=setup_ctx,          # interceptor
    before_model_callback=require_image,      # interceptor
    after_model_callback=schema_guard,        # interceptor
)
```

| Piece | Role |
|---|---|
| `model` | The LLM the agent runs on. It performs the reasoning. |
| `instruction` | The system prompt: the agent's standing directive and rules. |
| `skills` | Versioned written procedures the agent follows. |
| `tools` | Python functions or MCP tools the agent can call. ADK builds each declaration from the function's name, signature, and docstring. |
| `output_schema` | A Pydantic model the final answer must fill, so callers receive structured JSON. |
| `before_*` / `after_*` callbacks | Your deterministic code around the agent, each model call, and each tool call. |
| Session and Memory | State that lives outside the agent, in a SessionService and a MemoryService. |

The agent in this step uses three of these fields: `model`, `instruction`, and `tools`. The workflow in the next step is one way to orchestrate several agents and functions.

### Stage 0: the pipeline as one prompt

At the top left, click **Select an app** and choose **`stage0_prompt`**.

The instruction in `stage0_prompt/agent.py` describes the whole pipeline in prose:

*Check what is trending. Look at your back catalog. Propose a direction and agree on it with the creator. Refuse blacklisted subjects. Describe the video.*

Each sentence becomes a node over the next two steps. The two tools on this agent read the same sources the graph's research nodes read.

### The two tools

The agent's `tools=[check_trends, read_back_catalog]` are plain Python functions in the same file:

```python
def check_trends() -> dict:
    """Read what is trending on the platform right now."""
    from world import platform
    return {"trends": platform.trends()}


def read_back_catalog() -> dict:
    """List the channel's already-published videos and how they performed."""
    from agent import state
    from world import platform
    creds = state.load().get("creds")
    vids = platform.outcomes(creds["creator_id"]) if creds else []
    return {"backcatalog": [{"title": v["title"], "avg_watch_pct": v["avg_watch_pct"]}
                            for v in vids]}
```

ADK builds a tool declaration for each function from its name, signature, and docstring. When the model decides it needs the data, it emits a `function_call`; ADK runs the function and appends a `function_response` event with the return value, and the model continues with that data in context.

The agent's tool list is empty:

```python
    tools=[],  # TODO: TOOLS - add the two research tools
```

Without tools the model can only guess at trends and invent a back catalog. Add the two functions to the list. In Vibe Studio, step 3c has an editor for this file; from a terminal, open `stage0_prompt/agent.py` and change the line to:

<!-- code: TOOLS -->
```python
    tools=[check_trends, read_back_catalog],
```

The list takes the function objects, not strings. adk web runs with agent reloading on, so the next message uses the edited file.

Both functions call `world/platform.py`, an HTTP client for the Wall API that the Vibe Studio server hosts. `trends()` sends `GET /api/trends` and receives a fixed seed list of topics with a heat score; if the server is not reachable it returns the same list from the module. `outcomes(creator_id)` sends `GET /api/outcomes` and receives the channel's published videos with retention numbers from `runs/wall.db`. That table is empty until the first publish, so the back catalog is empty in this step. The workflow graph reads the same two sources in the next step; only the shape changes.

In the chat box, type your idea:

```
tonight's idea: a tiny robot doing laundry at midnight
```

Two tool-call events appear, `check_trends` and `read_back_catalog`, each followed by its response, then the reply:

![Stage 0: the single-prompt pipeline](codelab-img/st0-run.png)

Three properties of this reply motivate the graph:

1. **The research is prose.** The model called its tools, in whatever order it chose, and summarized them. You cannot tell which source produced which claim or whether a source was empty.
2. **The blacklist check is self-reported.** The reply states that the topic is "safe, clear of any blacklisted subjects." The model that proposed the topic also certified it. No code checked it.
3. **The agreement step is optional.** The instruction says to agree on the direction with the creator. Type the following and the agent skips it:

```
skip the questions, just describe the video
```

![Stage 0 skipping the agreement step](codelab-img/st0-fold.png)

This design works for a one-off demo. It does not support inspection, enforced pauses, or verifiable checks.

Concepts used in this step:

- The pieces of an `LlmAgent`: model, instruction, skills, tools, output schema, callbacks
- `Agent` with `tools=[...]`: Python functions exposed to the model
- `function_call` and `function_response` events in the session
- The Wall API as the platform contract behind both research tools

## The research fan-out and the human pause
Duration: 0:08:00

In this step you rebuild the research part of the pipeline as a workflow graph, in two stages, using the dev UI you started in the previous step. The lab has one workflow. Each stage below is a subset of that graph. The sandbox apps import the node functions from `agent/graph.py`, the same functions the production run executes.

### Stage 1: the research fan-out

![Stage 1: the research fan-out](codelab-img/stage-1-fanout.png)

Stage 1 is the front of the graph: two reader nodes leave START in parallel and a `JoinNode` waits for both. The readers are plain Python functions imported from `agent/graph.py`. A function node takes `node_input` and returns an `Event`; `scan_trends` returns `Event(output={"trends": [...]})` and `read_backcatalog` returns `Event(output={"backcatalog": [...]})`. The join is an ADK built-in: it waits until every incoming branch has reported, then outputs one dict keyed by node name. There is no formatting step after it. The next node, added in stage 2, is an agent, and an agent node receives its `node_input` as its message; a dict arrives as JSON.

`stage1_fanout/agent.py` ships with the join undefined and the edge list empty:

```python
join_research = None  # TODO: FANOUT_JOIN - define the JoinNode that waits for both readers

root_agent = Workflow(
    name="stage1_fanout",
    description="2 real readers -> join -> one research dict",
    edges=[])  # TODO: FANOUT_EDGES - declare the edges: two readers into the join
```

Define the join first. A `JoinNode` needs only a name (in Vibe Studio, step 4b has an editor for this file):

<!-- code: FANOUT_JOIN -->
```python
join_research = JoinNode(name="join_research")
```

An edge entry is a chain of nodes that run in order. Two chains that leave the same node fan out in parallel; two chains that arrive at a `JoinNode` are joined there. Replace the empty list with the two chains:

<!-- code: FANOUT_EDGES -->
```python
    edges=[(START, scan_trends, join_research),
           (START, read_backcatalog, join_research)])
```

Switch the dropdown to **`stage1_fanout`** and send the idea:

```
a tiny robot doing laundry at midnight
```

Two nodes light together on the map, then the join:

![Stage 1 running: two readers in parallel, one bundle out](codelab-img/st1-devui.png)

Compared with stage 0:

- Both readers ran, in parallel, because the edge list says so. The model cannot skip one.
- The output of `join_research` is one dict with both readers' results. Open its event to read it.
- `backcatalog` is empty because you have published nothing yet. It fills after the first publish.
- Two readers are wired. The final graph has four. The other two are added in the final two steps, one edge each.

### Stage 2: four candidates and the human pause

![Stage 2: the proposer and the human input node](codelab-img/stage-2-direction.png)

Stage 2 adds three nodes: `propose_directions`, an `Agent` used as a node that returns four typed candidates in one call; `direction_gate`, which suspends the graph for your choice; and `persist_direction`, which resolves your choice into a direction. You define the agent node yourself in `stage2_direction/agent.py`; the other two are imported from `agent/graph.py`. As shipped, the agent is undefined and the edge list holds only the two reader chains:

```python
propose_directions = None  # TODO: PROPOSER - define the agent node: Agent(name, model, instruction, output_schema)

root_agent = Workflow(
    name="stage2_direction",
    description="research -> 3 candidates -> the human door",
    edges=[(START, scan_trends, join_research),
           (START, read_backcatalog, join_research)])  # TODO: STAGE2_EDGES - add the third chain, from the join
```

### The agent node

`propose_directions` is the same `Agent` class as step 3, with a name, a model, an instruction, and an output schema, and without tools. Used as a node, an agent runs in `single_turn` mode by default: its input is the previous node's output, here the join's dict delivered as JSON, it answers once, and the answer goes to the next node. There is no conversation.

`config.MODEL` is the Gemini model step 3 used. `PROPOSE_INSTRUCTION` is a string constant in `agent/graph.py`, imported into the stage file; it asks for exactly three candidate directions, each with a title, an angle, and a hook, with evidence cited from the research. `Directions` is the output schema, from `agent/schemas.py`:

```python
class Direction(BaseModel):
    title: str           # <=60 chars, filmable, characterful
    angle: str           # the twist, one line
    hook: str = ""       # 2-4 words printed as the thumbnail's sticker
    evidence: list[Evidence]


class Directions(BaseModel):
    candidates: list[Direction]   # exactly 4
```

The schema is what matters for the rest of the graph. The model's reply is validated against it, so the next node receives a `Directions` object with exactly four candidates, not free text. Three are publishable directions grounded in the research. The fourth is written to be refused: the instruction asks for the outrage-bait pitch a rival channel would run, with a title that contains one of a short list of words from `agent/policy_words.txt`. It gives the policy gate in the next step something to catch on every run. Define the agent (in Vibe Studio, step 4c):

<!-- code: PROPOSER -->
```python
propose_directions = Agent(
    name="propose_directions",
    model=config.MODEL,
    instruction=PROPOSE_INSTRUCTION,
    output_schema=Directions)
```

Then start a third chain from the join. In step 4c the chain is `(join_research, propose_directions)`; step 4d appends `direction_gate`, which gives the full list:

<!-- code: STAGE2_EDGES -->
```python
    edges=[(START, scan_trends, join_research),
           (START, read_backcatalog, join_research),
           (join_research, propose_directions, direction_gate)])
```

With the chain at `(join_research, propose_directions)`, run `stage2_direction` in adk web. The fan-out and the join run, then the proposer, and the run ends. Open the `propose_directions` event: one model call, one structured reply with four candidates. Read candidate 4: it is the one the channel must never publish. Nothing asks you anything yet.

### Agent modes

An `Agent` has a `mode`. A plain agent, like the stage 0 agent, runs in `chat` mode: each user message is a turn and the model may call tools and reply as long as the conversation continues. An agent used as a workflow node defaults to `single_turn`: one call, one answer, and with an `output_schema` that answer is one structured object. That is why `propose_directions` produces its three candidates in one call and never asks you a question. ADK enforces the fit: a root agent must be `chat`, and a `chat` agent cannot follow another node in a `Workflow`.

### Human in the loop

A pipeline that publishes videos and spends money on renders needs a person at the decisions that require judgment: which direction to film, whether the thumbnail is right. In a single prompt, that is a request in the instruction, and step 3 showed that a message can override it. In a workflow, the decision is a node. The graph suspends there, the session records an open call, and only an answer to that call resumes it. No process waits in the meantime.

The node is `direction_gate` in `agent/graph.py`. It writes the candidates to state and returns without pausing:

```python
def direction_gate(node_input: Directions):
    cands = [c.model_dump() for c in node_input.candidates]
    yield Event(state={"candidates": cands})
    st = state.load()
    st["candidates"] = cands                             # driver clipboard copy
    state.save(st)
    # TODO: GATE_INPUT - suspend the graph here: yield a RequestInput with a message,
    # a response_schema (the form: one field, pick) and payload={"candidates": cands}
```

The answer to a pause becomes the next node's `node_input`. That node is code, not a model: `persist_direction` reads `pick` by name, and the policy check in step 5 is deterministic code too. Free text would hand every later step a parsing problem. A `response_schema` settles the shape of the answer once, at the pause, and ADK validates the answer against it before the graph resumes.

The same schema is the frontend contract. adk web renders it as a small form. Vibe Studio, which you start in step 5, renders the same schema as a radio list, and a chat bot or a phone app could render it without any change to the graph. `payload` travels with the request for that frontend to display: here the candidates, so a frontend does not have to read them out of state.

The schema for this pause has one property:

```python
"properties": {
    "pick": {"type": "string", "enum": ["1", "2", "3", "4"]}}
```

Replace the TODO comment with the yield that suspends the graph (in Vibe Studio, step 4d):

<!-- code: GATE_INPUT -->
```python
    yield RequestInput(
        message="Pick tonight's direction: 1, 2, 3 or 4.",
        response_schema={
            "type": "object",
            "properties": {
                "pick": {"type": "string", "enum": ["1", "2", "3", "4"]}}},
        payload={"candidates": cands})
```

Run `stage2_direction` in adk web before and after the edit. Before, the run ends after `direction_gate` with the candidates in state and no form. After, it stops on the form.

### RequestInput

`RequestInput` has three fields you set: `message`, the prompt shown to the person; `response_schema`, the JSON schema a frontend renders as a form and ADK validates the answer against; and `payload`, data that travels with the request for a frontend to display. ADK assigns the `interrupt_id`. The graph stops, and the session records an open call named `adk_request_input`. A `function_response` with that call's id resumes the graph; the answer becomes the next node's `node_input`. Nothing else resumes it: a chat message to the workflow is a new turn, not an answer.

Concepts used in this step:

- `Workflow` edge list, `START`, `JoinNode`
- Agent modes: `chat`, `single_turn`, `task`; an `Agent` as a `single_turn` node
- `RequestInput` with `message`, `response_schema`, and `payload`

### Reference (optional)

<aside class="positive">
<b>Parameter binding.</b> A function node binds its parameters from the run's state by default (<code>parameter_binding='state'</code>). <code>persist_direction(node_input, candidates=[])</code> received <code>candidates</code> from state. The parameter named <code>node_input</code> always holds the previous node's return value.
</aside>

<aside class="positive">
<b>Modifying the stage apps.</b> They are ordinary folders with no dependents and no checks. Add a node or change an edge and re-run; <code>--reload_agents</code> picks up the change. The stage diagrams above are generated from the same objects by <code>scripts/shape_maps.py</code>.
</aside>

## The policy gate and the first production run
Duration: 0:11:00

In this step you add the router that completes the graph, define the two nodes it routes to, rebuild one of them as a task-mode agent, read the edge list in `agent/graph.py`, start Vibe Studio, and run the graph as a production run.

### Part a: the router node

![The step 5 graph: the deterministic router](codelab-img/stage-3-router.png)

This step's app, `stage3_router`, ships with the step 4 chain and one more node after the gate: `persist_direction`, a function node that resolves your pick into the chosen candidate, a dict with a title, an angle, and a hook, and writes it to shared state. That dict is what the router reads.

A router is a plain function whose `Event` carries a route name next to its output. A sample:

```python
def length_check(node_input):
    too_long = len(node_input.get("title", "")) > 60
    return Event(output=node_input, route="TRIM" if too_long else "PASS")
```

The route is a name. An edge whose target is a dict maps each name to a node:

```python
    (length_check, {"TRIM": shorten, "PASS": scripter}),
```

The real router is `policy_check` in `agent/graph.py`. `policy_words()` reads `agent/policy_words.txt` when the node runs and matches whole words in the title and angle; the function computes `bad`, the list of refused words it found, records it in `runs/state.json`, and stops short of returning:

```python
    # TODO: POLICY_ROUTE - return an Event whose output is node_input and whose route is "BLOCK" if bad else "OK"
```

Write the return (in Vibe Studio, step 5a):

<!-- code: POLICY_ROUTE -->
```python
    return Event(output=node_input, route="BLOCK" if bad else "OK")
```

The same direction produces the same route every time, at no cost and with no network call, before any script is written or money spent.

The router routes to two nodes. `scripter` is an agent node like the proposer in step 4c: its message is the approved direction as JSON, its instruction is `SCRIPT_INSTRUCTION` in `agent/graph.py`, and its output schema is `Script`, with a title, a description, tags, an opening line, and exactly three shots for the render model:

```python
scripter = Agent(
    name="scripter",
    model=config.MODEL,
    instruction=SCRIPT_INSTRUCTION,
    output_schema=Script)
```

`quarantine` is the other exit, a placeholder function that reports the block and ends the run; part b replaces it:

```python
def quarantine(node_input):  # TODO: QUARANTINE - 5b replaces this placeholder with the task agent
    return Event(output={"blocked": True, "title": node_input.get("title", "")},
                 message="blocked: the channel's policy refused this direction")
```

Then wire the router: append `policy_check` to the chain and add the edge with the dict target. The chain ends at `persist_direction`:

```python
            persist_direction)])  # TODO: ROUTER_EDGES - append policy_check, then its two routes
```

Part a adds `policy_check` and the route edge; part b adds the last line, which gives the full list:

<!-- code: ROUTER_EDGES -->
```python
            persist_direction, policy_check),
           (policy_check, {"OK": scripter, "BLOCK": quarantine}),
           (quarantine, scripter)])
```

In adk web, switch to **`stage3_router`**, this step's app, and send the idea:

```
a tiny robot doing laundry at midnight
```

Answer the form with `1` and press **Submit**. The policy node's event shows `route: OK`. In the graph panel, `policy_check` is drawn as a diamond with two labeled exits, the OK edge lit and `quarantine` grey. The scripter runs and its event holds the `Script`.

![Route OK on the diamond, scripter lit, quarantine grey](codelab-img/st3-ok.png)

**A blocked direction.** Candidate 4 is written to trip the gate. Start a new run and answer the form with `4`:

![Route BLOCK, triggered by a word from the policy file](codelab-img/st3-block.png)

The run takes the BLOCK edge to `quarantine`, which reports the block, and ends. `scripter` stays grey. Nothing was scripted, rendered, or paid for. The route and the matched words are recorded in `lineage.gates.policy` in `runs/state.json`.

### Part b: agent modes and the task node

`mode` is an argument on `Agent`, with three values:

| Mode | Behavior | In this lab |
|---|---|---|
| `chat` | A conversation. Each user message is a turn; the model decides when to call tools, when to ask, and when to stop. Required for a root agent; not allowed after another node. | The stage 0 agent. |
| `single_turn` | One model call, no conversation. Input from the previous node, one structured object out. The default for an agent used as a node. | `propose_directions`, `scripter`. |
| `task` | The model works with its tools for as many calls as it needs and ends by calling the built-in `finish_task` tool. What it hands to `finish_task`, typed by `output_schema`, is the node's output. | `quarantine`, from here on. |

In part a a blocked direction ended the run. Now it is repaired. The task agent receives the refused direction as its message, calls `find_policy_hits` to learn which words tripped the gate, calls `suggest_replacement` for each one, rewrites the text, and checks again, for as many rounds as it needs. When the title and the angle both come back clean it calls `finish_task` with the cleaned direction, and that becomes the node's output, in the same shape the scripter already reads.

The two tools are in `agent/cleanup_tools.py`. Both are plain functions; ADK reads the signature and the docstring:

```python
def find_policy_hits(text: str) -> dict:
    """Which refused words appear in `text`. Matches whole words and phrases
    from agent/policy_words.txt, case-insensitive.

    Returns {"hits": [...], "clean": bool}. clean is true when hits is empty.
    """


def suggest_replacement(word: str) -> dict:
    """The channel's approved stand-in for a refused word, read from
    agent/policy_replacements.txt.

    Returns {"word", "replacement", "listed"}. When the word has no entry,
    listed is false and replacement is a hint to pick a gentle synonym.
    """
```

`agent/policy_replacements.txt` is data, like the policy: one `refused => replacement` line per word. `QUARANTINE_INSTRUCTION` in `agent/graph.py` spells out the loop, and `CleanedDirection` in `agent/schemas.py` is the output schema: a title, an angle, and a hook. Replace the placeholder with the task agent (in Vibe Studio, step 5b):

<!-- code: QUARANTINE -->
```python
quarantine = Agent(
    name="quarantine",
    model=config.MODEL,
    mode="task",
    instruction=QUARANTINE_INSTRUCTION,
    tools=[find_policy_hits, suggest_replacement],
    output_schema=CleanedDirection)
```

Two things make this a task and not a single turn: the agent has tools, and it ends by calling `finish_task`. ADK adds that tool itself when `mode="task"` is set and shapes its parameters from `output_schema`.

Then add the last edge, `(quarantine, scripter)`, so the cleaned direction continues to the scripter instead of ending the run. Start a new run and answer with `4` again. `policy_check` shows `route: BLOCK`; then quarantine's events arrive: a `find_policy_hits` call and its result, `suggest_replacement` calls, another `find_policy_hits`, and finally `finish_task` carrying the cleaned title, angle, and hook. The scripter runs on the cleaned direction and writes the script. Compare its title with candidate 4's: the scene is the same, the refused words are gone.

### The replacement table

| Stage 0 prompt sentence | Replaced by | Result |
|---|---|---|
| "check trends, look at the back catalog" | 2 reader nodes + `join_research` | Both run, in parallel, on every run |
| "propose a direction and agree on it with the creator" | `propose_directions` → `direction_gate` (`RequestInput`) | Four typed candidates in state, and a pause the model cannot skip |
| "refuse blacklisted subjects" | `policy_check` + a labeled edge + `policy_words.txt`, then `quarantine` as a task agent | A recorded route, decided before any spend; a refused direction repaired with tools instead of ending the run |
| "describe the video" | `scripter` (an `Agent` node) | The model writes the script after the gate |
| The implied sequence ("then… then…") | The edge list | Order is declared, not inferred |

### The edge list

`wf = Workflow(...)` at the bottom of `agent/graph.py` declares the graph you built in stages:

<!-- code: EDGES -->
```python
        (START, scan_trends, join_research),
        (START, read_backcatalog, join_research),
        (join_research, propose_directions, direction_gate,
         persist_direction, policy_check),
        (policy_check, {"OK": scripter, "BLOCK": quarantine}),
        (scripter, store_script),
```

The Studio app's driver imports `wf` from this file. Two lines below it are commented out and marked `TODO: GRAPH_EDGE` and `TODO: MEMORY_EDGE`. Each connects one research feed. You uncomment them in the final two steps. With the tools edit in step 3 and the three edits in step 4, they are the six code edits in this lab.

`direction_gate` suspends the graph with this call:

```python
    yield RequestInput(
        message="Pick tonight's direction: 1, 2, 3 or 4.",
        response_schema={
            "type": "object",
            "properties": {
                "pick": {"type": "string", "enum": ["1", "2", "3", "4"]}}},
        payload={"candidates": cands})
```

A node that yields `RequestInput` suspends the graph. The `response_schema` is what a frontend renders as a form and what the answer is validated against; the `payload` carries the candidates for that frontend to show.

### Start Vibe Studio

The stages ran in the inspector. The production run happens in Vibe Studio, which drives the same graph. adk web stays running on port 8000; Vibe Studio is a separate server on port 4600.

In a third terminal tab (**tab 3**), start the app server:

```console
cd ~/vibe-studio-lab
source .venv/bin/activate
scripts/start.sh
```

Click **Web Preview → Change port → 4600**:

![Vibe Studio idle: enter an idea, or leave it empty](codelab-img/s2-idle.png)

### Run the pipeline

You make three inputs in a production run: the idea, the direction, and the thumbnail approval (in the next step). The research, proposal, policy check, script, render submission, and publish run without input.

On the Now card, type your idea (or leave it empty and the pipeline chooses its own), then press **Start a lap ▸**:

```
a tiny robot doing laundry at midnight
```

A map appears above the card. The two research nodes light together, then `join_research` and `propose_directions`. After about 20 seconds, the marker stops on `direction_gate` with three candidates below it:

![The live map: research done, four candidates waiting for your pick](codelab-img/s2-flow-form.png)

Two facts about the map:

- Its nodes and edges are read from the live `Workflow` object (`wf.graph.edges`, each edge carrying `from_node.name` and `to_node.name`). The layout table only positions nodes. A node the layout table does not know is still drawn. When the graph gains a node in part 2, the map shows it.
- A node turns solid when the run writes that node's output to `runs/state.json`. Nothing is on a timer.

The card lists the four candidates as radio buttons with candidate 1 selected. Choose one and press **Continue ▸**. The footer states what the click sends: one `function_response`, explained in the next step.

![The direction card: candidate 1 already picked, Continue is the one click](codelab-img/s2-direction-click.png)

The graph continues: `persist_direction`, `policy_check` on its **OK** edge, then `scripter` and `store_script`. Within a few seconds the render row reads **rendering with Veo**. One clip for the whole script was submitted, and the thumbnail is being generated.

![Renders started automatically; the run finishes after you judge the thumbnail](codelab-img/s2c-rendering.png)

Stop here. The next step covers the thumbnail approval.

Concepts used in this step:

- A function node as a router, with an edge dict keyed by route name
- Policy stored as data and read at decision time
- The production app driving the same `Workflow` object as the sandbox apps

### Reference (optional)

<aside class="positive">
<b>NO DEFAULT on the diamond.</b> adk web flags a router with no fallback edge (the tag is visible on the policy diamond in the stage 3 map). If <code>policy_check</code> returned a route other than <code>OK</code> or <code>BLOCK</code>, the run would have no destination. Adding <code>DEFAULT_ROUTE: quarantine</code> to the edge dict fixes it (import <code>DEFAULT_ROUTE</code> from <code>google.adk.workflow</code>).
</aside>

<aside class="positive">
<b>BLOCK in Vibe Studio.</b> A "write my own" direction containing a policy word ends the run at <code>quarantine</code>. The app reads <code>lineage.gates.policy</code> and shows <i>"Blocked — by your own policy. Nothing was scripted, rendered or paid."</i> with a new idea box.
</aside>

<aside class="positive">
<b>JoinNode.</b> The research branches converge on a <code>JoinNode</code>. It waits for every connected feed, then passes all of their outputs on as one dict. Connecting a new feed in part 2 does not change the join.
</aside>

<aside class="positive">
<b>Optional checks.</b> In tab 1: <code>python -m checks.check workflow</code> (the graph ran and its evidence citations are real) and <code>python -m checks.check hitl</code> (candidates in state, your pick became the direction, the policy gate recorded a route).
</aside>

## Approve the thumbnail and publish
Duration: 0:07:00

In this step you approve the video's thumbnail. The run then delivers the render, passes the publish backstop, and publishes the video to your channel. If Setup joined a room, it also posts to the room's VibeTube.

This step also covers how the run waits: `LongRunningFunctionTool`, the `pending` receipt, and resuming a call by id. It then covers the one decision ADK leaves to your code: when the run is finished.

Current state: your direction passed the policy gate, the script was written, and the render was submitted. The desk agent holds one pending render call. The app holds one pending question for you. ADK delivers both answers by call id. Your code decides when the four together mean "done".

### Long-running tools

![LongRunningFunctionTool: the job is dispatched and a receipt is returned immediately](codelab-img/d6-lrft.png)

When the script reaches the desk agent, it calls the tool once. The `LongRunningFunctionTool` wrapper starts the Veo operation (green) and returns a receipt to the agent (orange). The agent replies WAITING and the turn ends. No process blocks. The only record is a row in `sessions.db`.

`agent/desk.py` defines the desk as a plain `Agent` with one wrapped tool:

```python
def render_submit(prompt: str) -> dict:
    """Submit the video render to Veo. Returns at once; the result arrives later."""
    from . import videogen
    receipt = videogen.start(prompt)
    return {"status": "pending", "operation": receipt["operation"], "prompt": prompt}
```

`videogen.start` in `agent/videogen.py` turns the whole script into one prompt and calls Veo's `generate_videos`, which returns a long-running operation in about two seconds. The receipt carries the operation's name; that string is all a later process needs to find the render again.

```python
render_desk = Agent(
    name="render_desk", model=config.MODEL,
    tools=[LongRunningFunctionTool(render_submit)],
```

`LongRunningFunctionTool` marks a tool whose return value is a receipt and whose real result arrives later. The receipt is the dict above. `pending` is a plain value in a normal tool response, stored in the session log. In the previous step, `agent/render.py` sent the three shot prompts to this desk in one turn, so the desk's session holds three receipts. A Veo operation runs for each one, outside the agent's process.

The thumbnail approval uses the same construct with a person answering. `thumb_desk` in the same file wraps `request_thumb_approval`, which returns `{"status": "pending", "kind": "thumb", ...}`. The card you will see in Vibe Studio is that pending call.

**Resuming a call.** A pending call is closed by a `function_response` with the same call id. `answer()` in `agent/drive.py` builds it:

<!-- code: RESUME -->
```python
    part = gtypes.Part(function_response=gtypes.FunctionResponse(
        id=call_id, name=name, response=response))
    return await _drive(node, session_id, [part], user_id)
```

The function builds a `Part` containing a `FunctionResponse` with the original `id` and sends it into the session as a new message. The Approve button, the finish worker, and adk web's response box all use this path. Ten lines above it, `Runner(app_name=…, session_service=svc(), auto_create_session=True)` drives the agent and `svc()` returns the `DatabaseSessionService` that stores the session.

**Finding open calls.** The event that carries a long-running call also carries `long_running_tool_ids`. `pending()` in the same file scans a session's events, collects those ids, keeps the latest response per id, and returns the ones still marked `pending`. The finish worker and the Studio UI use it to find work.

### The join condition

`try_finish()` in `agent/joinlogic.py` defines "done" in two lines:

<!-- code: JOIN_CONDITION -->
```python
    still = drive.run(drive.pending(desk_sid(st)))
    human_ok = any(a["kind"] == "thumb" for a in st["lineage"]["approvals"])
```

The run is finished when the render call is no longer pending and the thumbnail approval is recorded. The machine result and the human answer arrive in either order. ADK delivers each by id; this function counts them.

### Approve the thumbnail

In Vibe Studio (the port 4600 preview), the card reads **Ship this thumbnail?**. The image was generated from your direction by `world/thumbstudio.py`, with the direction's hook printed on it as a caption:

![The pre-publish review: generated from your direction, judged by you](codelab-img/s2-thumb-approve.png)

The card is the pending `request_thumb_approval` call. Your click is the `function_response`. Two options:

- **↻ Regenerate** generates another thumbnail from the same direction and asks again.
- **Approve ▸** records the approval and starts the finish worker.

Press **Approve ▸**. The busy banner shows the worker running.

### The finish worker

`agent/finish.py` runs this loop:

```python
    while time.time() - t0 < budget:
        for cid, name, resp in drive.run(drive.pending(sid)):
            status = videogen.check(resp["operation"])
            if not status["done"]:
                continue
            if "error" in status:
                joinlogic.handle_failed(cid, name, resp, status)
            else:
                joinlogic.handle_done(cid, name, resp, status)
        if joinlogic.try_finish() is not None:
            return
```

Each round: ask Veo about the pending operation, deliver a finished result to its pending call by id (`handle_done` calls `answer()`), resubmit a render Veo rejected (`handle_failed`, up to `STUDIO_VIDEO_RETRIES` times), then call `try_finish()`. In production this loop is a queue worker, a webhook handler, or a scheduled reconciler. In this app it runs when you approve, because no further human input is needed after that point.

The card changes to **On the wall.** after the Veo clip finishes, typically a minute or three:

![Vibe Studio, the Now tab: On the wall, your video is published](codelab-img/s2c-published-v2.png)

The card shows a link to your channel and an idea box for the next run. The idea box is already filled in. The Session state step explains why.

If Setup joined a room, the card also shows **"and the room can see you"** with a watch link. The same approval posted the video to the room's VibeTube. Follow the link to see your card in the room's grid:

![Your card in the room's VibeTube, next to everyone else's](codelab-img/s2d-vibetube-room.png)

Without a room, the line is absent.

Open the **Channel** tab. Your card shows the approved thumbnail. Press **▶** to play:

![Vibe Studio, the Channel tab: your video on the wall, thumbnail first](codelab-img/s2c-channel-play.png)

The video is the Veo clip, about eight seconds, saved as `app/static/renders/<operation>_<stamp>.mp4` and served by the same app.

### The publish backstop

Between the join and the publish, a second workflow in `agent/post.py` ran:

![The publish backstop: editor, one eval, the side effect](codelab-img/shape-4-post.png)

The policy gate ran inside the main graph before any spend; its route is in `runs/state.json` under `lineage.gates.policy`. The script stage ran after that gate, so `eval_gate` checks what the script introduced: title length, tags, and that every evidence citation in the lineage points at a source that exists. Only **PASS** reaches `publisher`.

Concepts used in this step:

- `LongRunningFunctionTool` and the `pending` receipt
- `function_response` with the original call id as the resume path
- Scanning `long_running_tool_ids` to find open calls
- A driver-owned join condition
- A separate workflow for the side effect

### Reference (optional)

![What long-running means: five moments, one surviving row](codelab-img/d3-longrunning.png)

One wait over time: (1) the desk submits, (2) the pending receipt is written to `sessions.db`, (3) the turn ends with no process running, (4) the server stops and the row is unchanged, (5) a process delivers the result with the same call id and the session continues.

<aside class="negative">
<b>Text does not close a pending call.</b> A text message to the desk is a new user turn. The model can reply to it, but the pending <code>function_call</code> stays open until a <code>function_response</code> with its id arrives.
</aside>

<aside class="positive">
<b>The delivery process.</b> Every long-running system has a component that connects results to waiting calls: a queue worker, a webhook handler, a scheduled reconciler. ADK provides the primitives (pending calls in a session, <code>function_response</code> to resume). The connecting process is application code. Here it is <code>agent/finish.py</code>; in production it is a Cloud Run job or a webhook target.
</aside>

<aside class="negative">
<b>Why the workflow holds no machine waits.</b> A resumed graph re-runs its nodes. An external submission inside a node would be submitted, and paid for, twice. Machine waits live in the desk's plain session; the graph pauses only for people.
</aside>

<aside class="positive">
<b>Why <code>post</code> is a separate workflow.</b> <code>publisher</code> has a side effect, and a resumed graph re-runs its nodes. The main graph ends at the script, the renders and your approval happen outside it, and <code>wf_post</code> runs once afterward with its own <code>Runner</code> and session id (<code>&lt;run_id&gt;_post</code>).
</aside>

<aside class="positive">
<b>Retries.</b> Every Veo call in <code>agent/videogen.py</code> retries: the submission, the status check, and the download, each up to <code>STUDIO_VIDEO_RETRIES</code> times (default 3), <code>STUDIO_VIDEO_INTERVAL</code> seconds apart (default 15). A render Veo rejects or filters is resubmitted through the same desk call, up to the same count. A render that never finishes inside <code>STUDIO_VIDEO_TIMEOUT</code> seconds (default 600) is recorded as failed with the reason, and the lap publishes with a text manifest in place of the video. Nothing is left pending.
</aside>

<aside class="positive">
<b>Idempotent publish.</b> The publish POST carries an <code>Idempotency-Key</code>. A replay returns the original video id instead of creating a duplicate. The <code>lap</code> check re-sends the POST and asserts the same id.
</aside>

<aside class="positive">
<b>The room post.</b> After the wall publish succeeds, <code>joinlogic.try_finish</code> calls <code>premiere.publish_to_room()</code>: one multipart POST with title, description, your display name, the video, and the thumbnail to <code>POST /api/events/&lt;room&gt;/videos</code>. Re-running the same lap replaces your entry (same <code>projectId</code>). A <code>200</code> means accepted, not playable; the platform transcodes in the background, so the card may read "processing" for a minute or two. Read it with <code>cloudshell edit ~/vibe-studio-lab/agent/premiere.py</code>.
</aside>

<aside class="negative">
<b>Room failures.</b> A room failure does not fail the run. The card shows <code>room: skipped (…)</code> with the platform's reason. <code>403</code>: the upload window is closed. <code>413</code>: over the limits (50 MB video, 5 MB images). <code>404</code>: wrong room code. Fix <code>.env</code> or wait for the window, then re-post with <code>python -m agent.premiere</code> in tab 1.
</aside>

**Running the worker from the terminal.** On a later run, when the thumbnail card appears, run this in **tab 1** instead of pressing Approve:

```console
cd ~/vibe-studio-lab
source .venv/bin/activate
python -m agent.finish
```

It auto-approves the thumbnail and prints the delivery. The `render failed` line appears only when Veo rejects a render:

```
── human approval: thumbnail — AUTO-APPROVED [workshop mode] ──
── render failed: the model returned no video (filtered or empty) (attempt 1/3) ──
  desk: 'WAITING'
── result delivered: projects/…/operations/… ──
── join complete (render done + human) -> post-production ──
PUBLISHED: {'published': True, 'video_id': 'v_…', 'url': '/watch/v_…'}
```

**Raw events in adk web.** Open the port 8000 preview and change `userId=user` to `userId=creator` in the URL (adk web files your chats under user `user`; the run's sessions belong to `creator`). Select the `vibestudio` app, click **NEW SESSION ▾**, and open the newest `run_…_wf` session. From top to bottom: the three candidates in state, the `adk_request_input` with the pick schema, your pick as a `function_response`, `user:prefs` and `direction` in state, the policy route, and the script.

![One run in raw events: candidates, the pause, your pick, the route](codelab-img/s2-adkweb-wf.png)

The newest `run_…_desk` session shows one `render_submit` call, the WAITING reply, and the delivered url closing the call by id.

![The desk: the pending call, then its result by id](codelab-img/s2-adkweb-desk.png)

<aside class="positive">
<b>Optional check.</b> In tab 1: <code>python -m checks.check lap</code>. It asserts that the graph ran, the human pauses were answered by id, the render result was delivered, and publish passed the gates and is idempotent.
</aside>

## The audience graph in BigQuery
Duration: 0:06:00

![BigQuery graph context: four node tables, three edges](codelab-img/d8-graph.png)

The four cards are BigQuery tables. The three arrows are edges declared over them: creators publish videos, videos are about topics, viewers watch videos. The `watched` edge carries the retention columns `watched_ms` and `drop_ms`. The channel's questions are paths across this graph: one hop for "where do viewers drop off", three hops for "what else do my finishers finish".

In this step you build the audience's watch data as a BigQuery property graph, then connect the `read_graph` node to the workflow with one edge. From that run on, candidates cite graph readings by name.

- **Store:** a BigQuery dataset, `vibestudio`, in your project.
- **Why this store:** watch data is shared with other tools and outlives this VM.
- **Setup:** one button in the app's **World** tab runs `scripts/graph.sh`, which creates the dataset, loads the vendor pack, declares the graph, and inserts your rows. Then one edge in `agent/graph.py` connects `read_graph` to the fan-out.
- **Use:** `read_graph` queries the graph on every run.

### Why BigQuery, and whether a graph is needed

Watch rows are the platform's data, not the agent's. They are shared across tools and persist after `state.json` is deleted. The wall's SQLite database stands in for that platform data in this lab.

`taste_graph` is a declaration over existing tables. No data is copied and no new system is deployed. Two questions decide whether the declaration is useful:

| Question | In this lab |
|---|---|
| How many hops is the question? | "Where do viewers drop off" is one hop and runs as SQL; the report tags it `engine: sql`. "What else do my finishers finish" is three hops (me → video ← viewer → video → topic) and runs as one `MATCH`. |
| Does the relationship carry data? | `watched_ms` and `drop_ms` belong to the watch, not to the viewer or the video. |

A many-to-many relationship alone does not need a graph. Multi-hop questions over many-to-many edges do.

### The edge declaration

`GRAPH_DDL` in `bqgraph/load.py` declares the four tables as nodes, then the `watched` edge:

<!-- code: EDGE_TABLE -->
```sql
    `{d}.watched` AS watched
      KEY (viewer_id, video_id)
      SOURCE KEY (viewer_id) REFERENCES viewers (id)
      DESTINATION KEY (video_id) REFERENCES videos (id)
```

| Clause | Meaning |
|---|---|
| `KEY` | The columns that identify one edge row |
| `SOURCE KEY … REFERENCES` | The node the edge starts from |
| `DESTINATION KEY … REFERENCES` | The node the edge ends at |

The table's other columns (`watched_ms`, `drop_ms`, `completed`) become edge properties. `published` and `about` are declared the same way.

### Build the graph

In Vibe Studio, open the **World** tab:

![The World tab before anything is loaded](codelab-img/s4-world-empty.png)

Press **Build + read the graph ▸**. The caption names the command: `bash scripts/graph.sh`. The script runs three steps: **CONNECT + LOAD** (dataset, vendor pack, DDL), **STORE** (your rows), **READ** (the queries). Output streams into the page for about 40 seconds:

![The graph being built: step 1 complete, output arriving live](codelab-img/s4-world-running.png)

A dot turns solid when the script prints that step's banner. The app runs the script and tails its log; it does not call BigQuery itself.

The three readings appear when the third step finishes:

![The three readings, from your project](codelab-img/s4-world-done.png)

The `engine` chip on each reading shows how it ran: `graph#1` as **sql** (one hop), `graph#2` and `graph#3` as **gql** (two and three hops). The median drop just before 5 seconds becomes a rule in the Memory Bank step.

### View it in the console

Open [console.cloud.google.com/bigquery](https://console.cloud.google.com/bigquery) and select your project. In the Explorer, expand the project, then the `vibestudio` dataset. **Tables** lists the six tables with row counts. **Graphs → taste_graph** shows the declared graph:

![Your edges drawn: 4 nodes, 3 edges in the console's graph editor](codelab-img/s4-console-graph.png)

### Connect read_graph (the GRAPH_EDGE hole)

`read_graph` is a node in `agent/graph.py` with no incoming edge. In **tab 1**, open the file:

```console
cloudshell edit ~/vibe-studio-lab/agent/graph.py
```

In the edge list, find the line marked `TODO: GRAPH_EDGE`. Delete it and uncomment the line below it:

<!-- code: GRAPH_EDGE -->
```python
        (START, read_graph, join_research),
```

![Before and after in the editor: the TODO line goes, the edge line loses its #](codelab-img/s4-edit-before-after.png)

The join waits for every connected feed and passes on whatever arrives, so no other line changes.

Reload Vibe Studio. When the next run starts, the map shows the new node:

![The map after the edit: read_graph (circled) joins the fan-out the moment the edge exists](codelab-img/s4-map-grown.png)

### Run the second video

1. Open the **Now** tab.
2. Press **Start next lap ▸** (keep the pre-filled idea or type another) and wait about 20 seconds. Three research nodes light together.
3. The direction card's candidates carry evidence chips: `trends`, and `graph#N` once your watch rows are in the graph:

![The candidates now carry evidence chips: readings the agent may cite by name](codelab-img/s4-evidence-graph.png)

   Which chip a given run cites varies. `read_graph` now runs on every lap, and its readings are available to cite. The World tab shows the readings themselves.
4. Pick a direction, press **Continue ▸**, and press **Approve ▸** when the thumbnail card appears. The next two steps use this run: the Session state step reads what it left behind, and the Memory Bank step distills its audience data.

Concepts used in this step:

- A property graph declared over existing BigQuery tables
- Edge properties for relationship data
- GQL `MATCH` for multi-hop queries, SQL for one hop
- Adding a node to a running workflow with one edge

### Reference (optional)

<aside class="positive">
<b>From the terminal.</b> <code>bash scripts/graph.sh</code> in tab 1 prints the same three banners. The three steps are <code>python -m bqgraph.load</code>, <code>bqgraph.export</code>, and <code>bqgraph.report</code>. <code>report</code> writes <code>runs/graph_report.json</code>, which the World tab renders.
</aside>

<aside class="positive">
<b>Optional DDL clauses.</b> An edge can also declare <code>LABEL x PROPERTIES (a, b, c)</code>. Without <code>PROPERTIES</code>, every column is a property (which is why <code>w.completed</code> works in the queries). Without <code>LABEL</code>, the alias is the label.
</aside>

<aside class="positive">
<b>Authentication.</b> <code>_bq()</code> in <code>bqgraph/queries.py</code> is <code>bigquery.Client()</code> with no arguments. Cloud Shell supplies Application Default Credentials. On a laptop, run <code>gcloud auth application-default login</code>. In CI, use workload identity. No service account key file is used.
</aside>

<aside class="positive">
<b>GQL and SQL.</b> Each path query in <code>bqgraph/queries.py</code> exists as a GQL <code>MATCH</code> and as an equivalent SQL join. The <code>engine:</code> tag in the report records which ran.
</aside>

<aside class="positive">
<b>Privacy floor.</b> Queries return only cohorts of at least <code>K_ANON</code> viewers (2 in this dataset; a production platform uses about 10 or more) and never return viewer ids.
</aside>

<aside class="negative">
<b>The TODO guard.</b> The shipped starter has every DDL edge in place. If an edge is carved out in authoring mode, stages 1 and 3 raise <code>NotImplementedError: TODO: EDGE_TABLE</code> instead of creating a graph with missing edges.
</aside>

<aside class="positive">
<b>Optional check.</b> In tab 1: <code>python -m checks.check graph</code>. It asserts that <code>taste_graph</code> exists in your project, your rows are in it, and a path query about your videos returns rows.
</aside>

## Session state and the user: prefix
Duration: 0:07:00

![Where state lives while the agent waits: every write and read of one run](codelab-img/d4-state.png)

The left column is one run. The right column is the five storage layers. Solid arrows are writes: events and preferences into `sessions.db`, the ledger into `state.json`, rows into BigQuery, notes into Memory Bank. Dashed arrows are reads, and each one feeds the next run.

Two videos are published. This step shows where their state lives, and how the app read a preference from the first run before the second one started.

Two facts drive this step. ADK session state persists in the SessionService, here a `DatabaseSessionService` backed by `runs/sessions.db`. A key with the `user:` prefix is scoped to the user across all of that user's sessions, not to one session. `persist_direction` writes such a key, `user:prefs`, on every run.

### The storage layers

| Lifetime | Written by | Location |
|---|---|---|
| One turn | The model | RAM of one call; discarded at turn end |
| Across restarts | ADK, on every event | `runs/sessions.db`: events, `session.state`, `user:` keys, every pending call |
| One run | Your driver | `runs/state.json` |
| The channel | The platform | The `vibestudio` dataset in BigQuery |
| The channel's lessons | `learn` | A Memory Bank resource: `projects/…/reasoningEngines/<id>` |

Studio's **State** tab shows this table with live values:

![The ladder, live: five lifetimes and what each is holding right now](codelab-img/s3-state.png)

### Restart the server

In **tab 3**, the terminal running `scripts/start.sh`, press **Ctrl+C**. The server stops. The Vibe Studio tab fails to load on its next refresh.

In the same tab, list the state directory:

```console
ls runs
```

```
graph_report.json  graph_run.log  sessions.db  state.json  ui_busy.json  wall.db
```

These files hold every wait, event, and key from the runs, plus the BigQuery readings from the previous step. The Memory Bank step adds `memorybank.json`, and a room adds `premiere_….mp4`.

Start the server again:

```console
scripts/start.sh
```

Reload the browser and open the **State** tab. Each row shows the same values as before the restart. The three render receipts and the thumbnail approval are rows in `sessions.db`. The run's brief and script are keys in `state.json`. The wall's rows are in `wall.db`. `memorybank.json`, once created, holds the resource name of the bank. The BigQuery dataset and the Memory Bank resource are not in this directory; they persist independently of this machine.

### How state is written and read

A node writes state by yielding `Event(state={…})`. The delta is appended to the event log, which is why it replays and survives a restart. Any code with the session reads `session.state`; both State tabs read it. The SessionService stores it. Replacing `DatabaseSessionService` with `VertexAiSessionService` moves the same events, state, and pending calls into managed Agent Engine sessions without changing agent code.

### The user: prefix

`persist_direction` in `agent/graph.py` writes five keys when you pick a direction:

```
    yield Event(state={"direction": chosen["title"], "angle": chosen.get("angle", ""),
                       "hook": hook, "constraints": constraints or "(none yet)",
                       "user:prefs": {"last_direction": chosen["title"],
                                      "idea": state.load().get("hint", "")}})
```

Four keys are session-scoped and end with the run. `user:prefs` is user-scoped and is visible from every session that user owns. `temp:` keys are never persisted.

### Reading the preference before a run exists

Open the **Now** tab. The published card from your second video shows an idea box next to **Start next lap ▸**, already filled with a topic derived from the direction you picked. The same box was already filled before the second run, from the first run's preference:

![The published card: the idea box is pre-filled from user:prefs with your last direction](codelab-img/s3-suggest-chip.png)

The app filled it from `user:prefs` in the SessionService, read by `server/services/run_state.py`:

```python
    prefs = drive.run(drive.ensure_user_state("_ui_probe")).get("user:prefs") or {}
    return prefs.get("last_direction", "")
```

The session id is `_ui_probe`, a session unrelated to any run. A `user:` key belongs to the user, so a new session for that user can read it. Restarting the app does not clear the box.

Do not press the button yet. The Memory Bank step starts the third video.

![Start next lap: the next step starts from this button, idea box already filled](codelab-img/s3-nextlap-click.png)

To view the same key in adk web:

1. Open **Web Preview → Change port → 8000**.
2. In the address bar, change `userId=user` to `userId=creator` and press Enter. Your own chats are under user `user`; the app's runs are under user `creator`.

<aside class="negative">
<b>Replace the value; do not append a second parameter.</b> The URL already contains <code>userId=user</code>. Adding <code>&amp;userId=creator</code> produces <code>No sessions found for user 'user,creator'</code>.
</aside>

![Step 2: one word changes, userId=user becomes userId=creator](codelab-img/s3-userid-bar.png)

3. Click the **NEW SESSION ▾** picker.
4. Click the newest `run_…_wf` session:

![Step 4: the picker lists the app's sessions once userId=creator is in the URL](codelab-img/s3-devui-picker.png)

5. Click the **State** tab. `user:prefs` appears beside the session-scoped keys:

![One store, two lifetimes: user:prefs beside the run's plain keys](codelab-img/s3-adkweb-state.png)

Concepts used in this step:

- `DatabaseSessionService` and `runs/sessions.db`
- `Event(state=...)` deltas on the event log
- The `user:`, `temp:`, and `app:` key prefixes

### Reference (optional)

<aside class="positive">
<b>Write path.</b> A node yields <code>Event(state={"user:prefs": …})</code>. The delta is committed to the event log in <code>sessions.db</code>. The SessionService folds it into <code>session.state</code>. Later sessions for the same user see the <code>user:</code> keys.
</aside>

<aside class="positive">
<b>Production session store.</b> <code>svc()</code> in <code>agent/drive.py</code> is one line: <code>DatabaseSessionService(db_url=…)</code>. Replace it with <code>VertexAiSessionService</code>, and point adk web's <code>--session_service_uri</code> at your Agent Engine, to store the same events, deltas, and pending calls in managed sessions.
</aside>

<aside class="negative">
<b>The other prefixes.</b> <code>temp:</code> keys are never persisted. <code>app:</code> keys are shared across all users of the app. The check below catches a <code>temp:</code> key that leaked into the store.
</aside>

<aside class="positive">
<b>Optional check.</b> In tab 1: <code>python -m checks.check state</code>. It asserts that <code>user:prefs</code> is readable from a new session, matches the direction you picked, and that no <code>temp:</code> key was persisted.
</aside>

## Memory Bank: connect, write, read
Duration: 0:10:00

![Memory Bank: the write and the read](codelab-img/d9-memory.png)

The bank sits in the middle with its scope and three topics. The left lane is the write: readings are distilled into sentences, and one `generate` call stores them; consolidation merges each new note with existing ones (CREATED or UPDATED). The right lane is the read: `read_memory` retrieves notes by similarity to a question, before any decision in the run.

In this step you create a Memory Bank, write notes from the previous run's audience data, and connect `read_memory` to the workflow with one edge. The third video then follows a rule derived from the audience.

- **Store:** a managed Memory Bank on an Agent Engine resource in your project.
- **Why this store:** notes must outlive runs, sessions, and this machine, and consolidation is a service.
- **Setup:** one command creates the resource and caches its name in `runs/memorybank.json`.
- **Use:** `learn` writes notes; `read_memory` retrieves them on every run.

### Connect: create the bank

`agent/memory.py` has two relevant parts:

- `_bank_config()` builds the configuration: `AgentEngineConfig → context_spec → memory_bank_config → memory_topics`. An Agent Engine with this block hosts a Memory Bank, and `memory_topics` define what a note may be about.
- `engine_name(create=True)` calls `agent_engines.create(config=…)` once and caches the returned resource name in `runs/memorybank.json`. Every read and write addresses that name.

<aside class="positive">
<b>Topics.</b> This lab defines three custom topics, <code>CHANNEL_LESSONS</code>, <code>CHANNEL_CONSTRAINTS</code>, and <code>AUDIENCE</code>, each with a one-line description that consolidation reads. They match the <code>[TOPIC]</code> prefixes the learner writes. Google also provides managed topics: <code>USER_PREFERENCES</code>, <code>USER_PERSONAL_INFO</code>, <code>KEY_CONVERSATION_DETAILS</code>, and <code>EXPLICIT_INSTRUCTIONS</code>.
</aside>

In Vibe Studio, open the **State** tab. The **Memory** row has a **Connect the bank ▸** button; its caption names the command, `python -m agent.bank`:

![The State tab: the Memory row's one-time Connect button](codelab-img/s5-connect-button.png)

Press it. After about 30 seconds the row shows the resource name and the command output. The button disappears because `runs/memorybank.json` now exists:

```
── created ──
  projects/…/locations/us-central1/reasoningEngines/3403957707466604544
scope for every note: app_name=vibestudio · user_id=creator
memory topics (custom): CHANNEL_LESSONS · CHANNEL_CONSTRAINTS · AUDIENCE
the bank holds 0 note(s)
```

![Connected: the resource name under the Memory row](codelab-img/s5-connected.png)

In the Cloud console, open [console.cloud.google.com/vertex-ai/agents/agent-engines](https://console.cloud.google.com/vertex-ai/agents/agent-engines), select your project, open the engine, and click its **Memory Bank** tab:

![The bank in the console: a managed resource in your project](codelab-img/s5-console-memorybank.png)

### Write: distill readings into notes

| | BigQuery graph | Memory Bank |
|---|---|---|
| Holds | Raw rows | Distilled sentences |
| Retrieved by | A query you write | Similarity to a question |
| Delivered to | A report | The agent's context during a run |

`distill()` in `agent/learn.py` converts the drop-at-5s reading into a conclusion-first rule and the neighbor overlap into one audience sentence. Notes contain no video ids, row counts, or job ids.

`write_facts()` in `agent/memory.py` writes them:

<!-- code: GENERATE -->
```python
    op = _cli().agent_engines.memories.generate(
        name=name,
        direct_memories_source=vt.GenerateMemoriesRequestDirectMemoriesSource(
            direct_memories=[{"fact": f} for f in facts]),
        scope=SCOPE, config={"wait_for_completion": True})
```

`direct_memories_source` supplies facts rather than a transcript. `scope` is this app and this user. `wait_for_completion` blocks until consolidation finishes, so the response includes a CREATED or UPDATED flag per memory. `name` is the resource created above.

To write the notes:

1. Open the **Now** tab. The card for the run you finished in the BigQuery step, still on screen, now has a **Learn from the audience ▸** button. The app shows it only when `runs/memorybank.json` exists.

![Step 1: the published card, now with the Learn button the bank unlocked](codelab-img/s2c-published.png)

2. Press it. The caption names the command, `python -m agent.learn`. Its `main()` runs three functions you have read:

```python
    from bqgraph import export as bq_export
    bq_export.main()          # re-align rows (the graph chapter's stage 2/3)

    facts = distill()         # readings -> notes (the code above)
    ...
    flags = memory.write_facts(facts)   # the generate call you just read
```

3. After about 30 seconds, open the **State** tab. The Memory Bank row lists the notes:

![Step 3: the bottom rung is no longer empty](codelab-img/s5-state-notes.png)

### Read: connect read_memory (the MEMORY_EDGE hole)

The bank has notes, but `read_memory` in `agent/graph.py` has no incoming edge, so no run reads them. Open the file (`cloudshell edit ~/vibe-studio-lab/agent/graph.py` in **tab 1** if it is closed). Find the line marked `TODO: MEMORY_EDGE`. Delete it and uncomment the line below it:

<!-- code: MEMORY_EDGE -->
```python
        (START, read_memory, join_research),
```

The graph now has the four readers shown in the pipeline diagram. `read_memory` retrieves notes and also writes the retrieved `CHANNEL_CONSTRAINTS` rule into state as `constraints`, where the scripter's prompt reads it.

### Run the third video

1. Open the **Now** tab and press **Start next lap ▸**. After about 20 seconds, four research nodes light together.
2. Read the direction card. The candidates state the outcome up front, because the retrieved `CHANNEL_CONSTRAINTS` note says conclusion-first. The evidence chips include both `graph#` and `memory#`:

![The loop closed: memory# beside graph# on the candidates](codelab-img/s5-cited-chips.png)

To see the retrieval in adk web:

1. Open **Web Preview → Change port → 8000**.
2. If the URL contains `userId=user`, change it to `userId=creator` and press Enter.
3. Click **NEW SESSION ▾**.
4. Click the newest `run_…_wf` session.
5. Scroll to the top of the event list and find the `State: constraints` chip among the research events:

![The research fan-out, raw: read_memory writing the recalled constraint into state](codelab-img/s5-recalled-prompt.png)

That chip is `read_memory` writing the retrieved note into state, alongside the other research nodes and before `propose_directions` runs.

Finish the video: pick a direction, press **Continue ▸**, and press **Approve ▸** when the thumbnail card appears.

### Three videos

Open the **Channel** tab:

![Three runs side by side: one channel, each video better than the last](codelab-img/s5-channel-3.png)

The first video used your typed idea. The second started from a pre-filled idea and cited graph readings. The third opened on the conclusion the audience data indicated. The edge list changed by two lines between the first and the third. If Setup joined a room, all three are on the room's VibeTube:

![The room's VibeTube: three posts from three runs](codelab-img/s5-room-3.png)

Concepts used in this step:

- `AgentEngineConfig` with `memory_bank_config` and custom `memory_topics`
- `memories.generate` with `direct_memories_source` and consolidation flags
- `memories.retrieve` by similarity, inside a workflow node
- Writing a retrieved rule into run state for a downstream agent node

### Reference (optional)

<aside class="positive">
<b>Connect from the terminal.</b> <code>python -m agent.bank</code> in tab 1 prints the same lines as the button. A second run prints <i>already connected</i>, because <code>runs/memorybank.json</code> exists.
</aside>

<aside class="positive">
<b>Write from the terminal.</b> <code>python -m agent.learn</code> in tab 1 prints the row alignment, the three distilled notes, and the consolidation flags: <code>CREATED memory#…</code> for a new note, <code>UPDATED</code> when the service merged the note into an existing one.
</aside>

<aside class="positive">
<b>Read from the terminal.</b> <code>python -m agent.learn --recall "what should my videos do in the first seconds?"</code> calls <code>memories.retrieve</code> with a similarity query and prints the constraint and the lesson. <code>memories.list</code> returns every note unranked; the Studio State tab uses it.
</aside>

<aside class="positive">
<b>Naming.</b> The console calls the product Agent Platform, the SDK namespace is <code>agent_engines</code>, and the resource path contains <code>reasoningEngines</code>. All three refer to the same resource. Deploying an agent to Agent Engine (<code>adk deploy agent_engine</code>) is a separate topic; this lab uses the resource only to host memory.
</aside>

<aside class="positive">
<b>ADK wrapper.</b> ADK wraps this resource as <code>VertexAiMemoryBankService(project, location, agent_engine_id)</code>. Pass it to the <code>Runner</code> as <code>memory_service</code>, or to <code>adk web</code> as <code>--memory_service_uri</code>. This lab calls the SDK directly so the requests are visible.
</aside>

<aside class="positive">
<b>Corrections.</b> <code>python -m agent.learn --forget &lt;id&gt;</code> deletes a note. <code>--inject "[CHANNEL_CONSTRAINTS] …"</code> writes one by hand.
</aside>

<aside class="positive">
<b>Optional check.</b> In tab 1: <code>python -m checks.check channel</code>. It asserts that the notes exist and contain no ids or row counts, the run cited a memory that exists, the script followed the conclusion-first rule, and the idea box was pre-filled from <code>user:prefs</code>.
</aside>

## Congratulations
Duration: 0:02:00

You built and ran a production pipeline: one idea, three videos, two decisions per video, and six small edits: the agent's tool list, a sandbox edge list, the RequestInput in direction_gate, persist_direction in the stage 2 chain, and two edges in the production graph.

| Step | What it covered |
|---|---|
| The pipeline as a single prompt | An `Agent` with function tools, `function_call` and `function_response` events, and the limits of prose as an interface |
| The research fan-out and the human pause | A parallel fan-out and `JoinNode`, an `Agent` as a node, `RequestInput` for a human decision, and shared state read by parameter name |
| The policy gate and the first production run | A function node as a router, policy stored as data, and the production app driving the same `Workflow` object |
| Approve the thumbnail and publish | `LongRunningFunctionTool`, the `pending` receipt, `function_response` by call id, a driver-owned join condition, and a separate workflow for the side effect |
| The audience graph in BigQuery | A property graph declared over existing tables, edge properties, GQL `MATCH`, and adding a node with one edge |
| Session state and the user: prefix | `DatabaseSessionService`, state deltas on the event log, and the `user:` prefix read from a new session |
| Memory Bank: connect, write, read | Creating a bank with custom topics, `memories.generate` with consolidation, and `memories.retrieve` inside a workflow node |

The graph's shape did not change after the edge list was written, apart from the two edges you added. What changed between videos was the state each run started with: a preference from the session store, readings from BigQuery, and a rule from Memory Bank. The routine work ran without input. You were asked for the direction and the thumbnail, and a policy rule refused a direction before any spend. The graph and its state files are the pipeline you would hand to another creator.

### Next steps

- Deliver render results by webhook (the same `answer()` call over HTTP) instead of polling the farm.
- Declare a second property graph beside `taste_graph`.
- Replace the session and memory stores with `VertexAiSessionService` and `VertexAiMemoryBankService`.
