"""THE HOLE REGISTRY - single source of truth for every hole in the lab.

Every hole is UNCOMMENT-style: the carved starter carries a TODO line (or a
loud raise) plus the real solution commented out right below it. The student
deletes the TODO/raise line and uncomments the block - no copy-paste.

Each hole: file · anchor (what the CARVED starter contains) · snippet (the
filled lines). Consumed by:
  scripts/carve.py    filled -> carved   (ships the starter)
  scripts/rescue.py   carved -> filled   (one hole at a time, for the stuck)
  checks/verify_holes.py  proves every hole round-trips and starter/ is in sync
  checks/verify_pastes.py additionally proves CODELAB.md code blocks == snippets
"""

HOLES = {
    # Step 4 · the stage 1 sandbox gets its edge list
    "FANOUT_JOIN": ("stage1_fanout/agent.py",
                    '''join_research = None  # TODO: FANOUT_JOIN - define the JoinNode that waits for both readers''',
                    '''join_research = JoinNode(name="join_research")'''),
    "FANOUT_EDGES": ("stage1_fanout/agent.py",
                     '''    edges=[])  # TODO: FANOUT_EDGES - declare the edges: two readers into the join''',
                     '''    edges=[(START, scan_trends, join_research),
           (START, read_backlog, join_research)])'''),

    # Step 4c · the human input node: the RequestInput yield in direction_gate
    "GATE_INPUT": ("agent/graph.py",
                   '''    # TODO: GATE_INPUT - suspend the graph here: yield a RequestInput with a message,
    # a response_schema (the form: one field, pick) and payload={"candidates": cands}''',
                   '''    yield RequestInput(
        message="Pick tonight's direction: 1, 2, 3 or 4.",
        response_schema={
            "type": "object",
            "properties": {
                "pick": {"type": "string", "enum": ["1", "2", "3", "4"]}}},
        payload={"candidates": cands})'''),

    # Step 4c · the stage 2 sandbox: the student defines the agent node
    "PROPOSER": ("stage2_direction/agent.py",
                 '''propose_directions = None  # TODO: PROPOSER - define the agent node: Agent(name, model, instruction, output_schema)''',
                 '''propose_directions = Agent(
    name="propose_directions",
    model=config.MODEL,
    instruction=PROPOSE_INSTRUCTION,
    output_schema=Directions)'''),

    # Steps 4c-4e · the stage 2 chain grows one node per part
    "STAGE2_EDGES": ("stage2_direction/agent.py",
                     '''    edges=[(START, scan_trends, join_research),
           (START, read_backlog, join_research)])  # TODO: STAGE2_EDGES - add the third chain, from the join''',
                     '''    edges=[(START, scan_trends, join_research),
           (START, read_backlog, join_research),
           (join_research, propose_directions, direction_gate)])'''),

    # Step 5 · the router's return line (5a), the quarantine node (a placeholder
    # function as shipped, the task agent in 5b), and the router edges
    "POLICY_ROUTE": ("agent/graph.py",
                     '''    # TODO: POLICY_ROUTE - return an Event whose output is node_input and whose route is "BLOCK" if bad else "OK"''',
                     '''    return Event(output=node_input, route="BLOCK" if bad else "OK")'''),
    "QUARANTINE": ("stage3_router/agent.py",
                   '''def quarantine(node_input):  # TODO: QUARANTINE - 5c replaces this placeholder with the task agent
    return Event(output={"blocked": True, "title": node_input.get("title", "")},
                 message="blocked: the channel's policy refused this direction")''',
                   '''quarantine = Agent(
    name="quarantine",
    model=config.MODEL,
    instruction=QUARANTINE_INSTRUCTION,
    mode="task",
    tools=[find_policy_hits, suggest_replacement],
    output_schema=CleanedDirection,
)'''),
    "ROUTER_EDGES": ("stage3_router/agent.py",
                     '''           (join_research, propose_directions, direction_gate)])  # TODO: ROUTER_EDGES - 5a: append persist_direction; 5b: append policy_check, then its two routes''',
                     '''           (join_research, propose_directions, direction_gate,
            persist_direction, policy_check),
           (policy_check, {"OK": scripter, "BLOCK": quarantine}),
           (quarantine, scripter)])'''),

    # Step 5a · the state write in persist_direction
    "PERSIST_STATE": ("agent/graph.py",
                      '''    # TODO: PERSIST_STATE - yield an Event whose state holds direction, angle, hook, and user:prefs''',
                      '''    yield Event(state={"direction": chosen["title"], "angle": chosen.get("angle", ""),
                       "hook": hook, "user:prefs": {"last_direction": chosen["title"]}})'''),

    # Step 6 · memory as two callbacks on the step 5 graph
    "MEMORY_RECALL": ("stage4_memory/agent.py",
                      '''    output_schema=Directions)  # TODO: MEMORY_RECALL - add before_model_callback=recall_taste''',
                      '''    output_schema=Directions,
    before_model_callback=recall_taste)'''),
    "MEMORY_REMEMBER": ("stage4_memory/agent.py",
                        '''    output_schema=Script)  # TODO: MEMORY_REMEMBER - add after_agent_callback=remember_pick''',
                        '''    output_schema=Script,
    after_agent_callback=remember_pick)'''),

    # Step 7 · the third reader joins the fan-out
    "RAG_NODE": ("stage5_rag/agent.py",
                 '''           (START, read_backlog, join_research),  # TODO: RAG_NODE - add the third reader into the join: (START, read_feedback, join_research)''',
                 '''           (START, read_backlog, join_research),
           (START, read_feedback, join_research),'''),

    # Step 8 · Veo as a long-running tool: the wrapper (8a) and the last chain (8b)
    "VIDEO_TOOL": ("stage6_video/agent.py",
                   '''    tools=[render_submit])  # TODO: VIDEO_TOOL - wrap it: LongRunningFunctionTool(render_submit)''',
                   '''    tools=[LongRunningFunctionTool(render_submit)])'''),
    "VIDEO_EDGES": ("stage6_video/agent.py",
                    '''           (quarantine, scripter)])  # TODO: VIDEO_EDGES - add the last chain: (scripter, render_desk, store_video)''',
                    '''           (quarantine, scripter),
           (scripter, render_desk, store_video)])'''),

    # Step 8a · the delivery answers the pending call by id
    "DELIVER_RESPONSE": ("agent/deliver.py",
                         '''    part = Part(function_response=None)  # TODO: DELIVER_RESPONSE - FunctionResponse(id=row["call_id"], name=row["name"], response=response)''',
                         '''    part = Part(function_response=FunctionResponse(
        id=row["call_id"], name=row["name"], response=response))'''),

    # Step 3 · the single-prompt agent gets its two research tools
    "TOOLS": ("stage0_prompt/agent.py",
              '''    tools=[],  # TODO: TOOLS - add the two research tools''',
              '''    tools=[check_trends, read_backlog],'''),


    # Act II · workflow — the base graph, drawn by you
    "EDGES": ("agent/graph.py",
              '''        # TODO: EDGES — delete me, uncomment the base graph below (Codelab: the policy gate step, the EDGES hole)
        # (START, scan_trends, join_research),
        # (START, read_backlog, join_research),
        # (START, read_feedback, join_research),
        # (join_research, propose_directions, direction_gate,
        #  persist_direction, policy_check),
        # (policy_check, {"OK": scripter, "BLOCK": quarantine}),
        # (quarantine, scripter),
        # (scripter, render_desk, store_video),''',
              '''        (START, scan_trends, join_research),
        (START, read_backlog, join_research),
        (START, read_feedback, join_research),
        (join_research, propose_directions, direction_gate,
         persist_direction, policy_check),
        (policy_check, {"OK": scripter, "BLOCK": quarantine}),
        (quarantine, scripter),
        (scripter, render_desk, store_video),'''),






}

# codelab section aliases for rescue
SECTIONS = {"s0": ["TOOLS"], "s1a": ["FANOUT_JOIN", "FANOUT_EDGES"], "s1b": ["PROPOSER", "GATE_INPUT", "STAGE2_EDGES"],
            "s2": ["PERSIST_STATE", "POLICY_ROUTE", "QUARANTINE", "ROUTER_EDGES", "EDGES"], "s5": ["MEMORY_RECALL", "MEMORY_REMEMBER"], "s6": ["RAG_NODE"], "s7": ["VIDEO_TOOL", "DELIVER_RESPONSE", "VIDEO_EDGES"]}
