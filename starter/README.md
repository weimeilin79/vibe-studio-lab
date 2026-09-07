# Starter files

The four files students edit during the lab, exactly as they receive them:
every hands-on hole carved out, everything else filled.

    stage0_prompt/agent.py      step 3c   tools=[]            (TOOLS)
    stage1_fanout/agent.py      step 4b   join + edges        (FANOUT_JOIN, FANOUT_EDGES)
    stage2_direction/agent.py   step 4c/4d chain              (PROPOSER, STAGE2_EDGES)
    stage3_router/agent.py      step 5a/5b                    (QUARANTINE, ROUTER_EDGES)
    agent/graph.py              step 4d   RequestInput yield  (GATE_INPUT); step 5a the router's return (POLICY_ROUTE); plus GRAPH_EDGE, MEMORY_EDGE

Reset after a rehearsal (server stopped):

    scripts/starter.sh

Keep this folder in sync when a hole changes: `checks/verify_holes.py` must
pass on the files here, which `scripts/starter.sh` checks after copying.
