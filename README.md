# VibeStudio - Agentic Workflow with ADK

The learning center for the **Vibe Studio** codelab. You run a short-video
channel, and over ten steps you build the workflow that runs it with the
Agent Development Kit: a research fan-out, an agent as a node, a human pause,
a policy router, a task agent, Memory Bank, RAG Engine, Veo as a long-running
tool, and finally an app on top of the whole graph, deployed to Cloud Run.

The walkthrough is [`CODELAB.md`](CODELAB.md). The lab pages (the same steps,
with in-page editors, runners and verify panels) are served by
`scripts/start.sh` at http://localhost:4600.

## What it teaches

| Step | Concepts |
|---|---|
| 3 · A single prompt | An `Agent` with function tools; `function_call` and `function_response` events |
| 4 · Fan-out and the human pause | `Workflow`, `START`, edges as tuples, `JoinNode`; an `Agent` as a node with `output_schema`; `RequestInput` |
| 5 · State and the policy gate | `Event(state=...)`, parameter binding, the `user:` prefix; a router node; policy as data; `mode="task"` with tools |
| 6 · Memory Bank | Scope, extraction, consolidation, custom topics; `before_model_callback` and `after_agent_callback` |
| 7 · RAG Engine | A corpus, chunking, an embedding model, retrieval by meaning as one more reader in the fan-out |
| 8 · The video | `LongRunningFunctionTool`, the pending receipt, a suspended workflow resumed by id from another process |
| 9 · Deploy | The `Runner`, an app with one event stream, a container on Cloud Run |

## Run it

```bash
git clone https://github.com/weimeilin79/vibe-studio-lab
cd vibe-studio-lab
./setup_project.sh              # a Google Cloud project with billing, recorded in ~/project_id.txt
./setup_codelab.sh              # uv + deps, the APIs, .env, one model call, then the learning center in the background on :4600
```

Both scripts can be run again; the second keeps the answers you gave before. It ends with `python scripts/preflight.py`, whose last line is the link to step 1. `kill $(cat runs/lab.pid)` stops the learning center and `scripts/start.sh` starts it again.

Steps 6 to 9 need a Google Cloud project with GEAP enabled (Cloud Shell
already has credentials): Memory Bank, RAG Engine, Veo, and Cloud Run.
`STUDIO_REAL_VIDEO=0` in `.env` replaces the Veo render with a stand-in that
finishes in five seconds, at no cost.

The app of step 9 runs on its own:

```bash
vibestudio/run.sh               # the app on http://localhost:4700
python vibestudio/deploy.py     # the same app on Cloud Run (or the button in step 9)
```

The app sends ADK's traces to Cloud Trace in your project (Trace Explorer, service `vibestudio`). `STUDIO_TRACING=0` turns that off.

## Repo map

```
agent/          the backend you read and edit: the graph (graph.py), the trend pool
                (trends.py), the backlog (backlog.txt), the render desk (desk.py), the
                delivery console (deliver.py), the policy word lists
agent/platform/ env and paths (config.py), the session helpers (drive.py), the run file
                (state.py), and the GEAP clients: Memory Bank (memory.py, bank.py),
                RAG Engine (rag.py), Veo (videogen.py)
stage0_prompt/ … stage6_video/
                the sandbox apps, one per step, each a subset of the same graph; adk web lists them
starter/        the nine hands-on files exactly as students receive them
server/ web/    the learning center: the editor API, the verifiers, the SSE stream, the mounted dev UI
vibestudio/     the app of step 9: server/ (main, api, runner), server/platform/ (bus, files,
                publish, avatar, telemetry, graphinfo), web/ (the page), server/agent/ (the finished agent)
checks/         the hole registry (holes.py) and its verifiers
scripts/        preflight · start · starter · carve · rescue · reset · dev
CODELAB.md      the lab itself; img/ holds its figures
```

## The holes

Every hands-on edit in the lab is a *hole*: a line students see (a `TODO`)
and the line they write in its place. `checks/holes.py` is the registry of
all seventeen, one entry per hole with the file, the shipped line and the
answer. The pages' hints show the same answers.

The scripts around the registry:

| Command | What it does | When |
|---|---|---|
| `scripts/starter.sh` | Copies the nine hands-on files back from `starter/`, wipes local run state and the session store, verifies. Stop the server first. | Before a class, or after a rehearsal, to reset to what students receive. |
| `python scripts/rescue.py RAG_NODE` | Writes one hole's answer into its file. A section name (`s5`) fills one step; no argument fills every hole. | A student stuck on one edit; or when you want a fully worked tree to rehearse a later step without typing the earlier answers. `carve.py` undoes it. |
| `python scripts/carve.py` | Puts the shipped `TODO` lines back (the inverse of rescue). | After a rescue, to return to the student state. |
| `python scripts/reset.py` | Wipes local run state only: `runs/state.json`, the session store, the worker logs. Keeps the `user:` keys unless `--all`. | Between runs, when the session store is confused. |
| `python scripts/preflight.py` | Checks the environment: the SDK, the credentials, every stage app imports. | Setup, and whenever something stops loading. |

Note that the app in `vibestudio/` carries its own complete copy of the
agent, so it works whether or not the holes in the lab are filled.

## For authors

Three checks keep the registry, the pages, the codelab and the app in
agreement. Run them after any change to a hole, a stage app, `agent/`, or a
code block in `CODELAB.md`:

```bash
python checks/verify_holes.py    # every hole round-trips (carve then fill) and starter/ is in sync
python checks/verify_pastes.py   # every <!-- code: HOLE --> block in CODELAB.md equals the registry's answer
python checks/verify_app.py      # vibestudio/server/agent/ equals the finished lab agent (--sync to copy)
```

When a hole changes: update `checks/holes.py`, update the codelab block,
run `scripts/carve.py`, copy the carved file into `starter/`, run
`checks/verify_app.py --sync`, then run all three checks.

`scripts/dev.sh` runs the learning center with hot reload (the API on 4600,
Vite on 5173). Diagram sources for the codelab figures live in
`img/src/`; the codelab is built with `claat`.
