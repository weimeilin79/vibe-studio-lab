"""THE HOLE REGISTRY - single source of truth for every hole in the lab.

Every hole is UNCOMMENT-style: the carved starter carries a TODO line (or a
loud raise) plus the real solution commented out right below it. The student
deletes the TODO/raise line and uncomments the block - no copy-paste.

Each hole: file · anchor (what the CARVED starter contains) · snippet (the
filled lines; byte-identical to solutions/). Consumed by:
  scripts/carve.py    filled -> carved   (ships the starter)
  scripts/rescue.py   carved -> filled   (one hole at a time, for the stuck)
  checks/verify_holes.py  proves carve+all-snippets == solutions, byte for byte
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
           (START, read_backcatalog, join_research)])'''),

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
           (START, read_backcatalog, join_research)])  # TODO: STAGE2_EDGES - add the third chain, from the join''',
                     '''    edges=[(START, scan_trends, join_research),
           (START, read_backcatalog, join_research),
           (join_research, propose_directions, direction_gate)])'''),

    # Step 5 · the router's return line (5a), the quarantine node (a placeholder
    # function as shipped, the task agent in 5b), and the router edges
    "POLICY_ROUTE": ("agent/graph.py",
                     '''    # TODO: POLICY_ROUTE - return an Event whose output is node_input and whose route is "BLOCK" if bad else "OK"''',
                     '''    return Event(output=node_input, route="BLOCK" if bad else "OK")'''),
    "QUARANTINE": ("stage3_router/agent.py",
                   '''def quarantine(node_input):  # TODO: QUARANTINE - 5b replaces this placeholder with the task agent
    return Event(output={"blocked": True, "title": node_input.get("title", "")},
                 message="blocked: the channel's policy refused this direction")''',
                   '''quarantine = Agent(
    name="quarantine",
    model=config.MODEL,
    mode="task",
    instruction=QUARANTINE_INSTRUCTION,
    tools=[find_policy_hits, suggest_replacement],
    output_schema=CleanedDirection)'''),
    "ROUTER_EDGES": ("stage3_router/agent.py",
                     '''            persist_direction)])  # TODO: ROUTER_EDGES - append policy_check, then its two routes''',
                     '''            persist_direction, policy_check),
           (policy_check, {"OK": scripter, "BLOCK": quarantine}),
           (quarantine, scripter)])'''),

    # Step 3 · the single-prompt agent gets its two research tools
    "TOOLS": ("stage0_prompt/agent.py",
              '''    tools=[],  # TODO: TOOLS - add the two research tools''',
              '''    tools=[check_trends, read_back_catalog],'''),

    # Publish step · long running — delivering a result, the three lines
    "RESUME": ("agent/drive.py",
               '''    raise NotImplementedError("TODO: RESUME — delete me, uncomment the delivery below (Codelab: the publish step)")
    # part = gtypes.Part(function_response=gtypes.FunctionResponse(
    #     id=call_id, name=name, response=response))
    # return await _drive(node, session_id, [part], user_id)''',
               '''    part = gtypes.Part(function_response=gtypes.FunctionResponse(
        id=call_id, name=name, response=response))
    return await _drive(node, session_id, [part], user_id)'''),

    # Act II · workflow — the base graph, drawn by you
    "EDGES": ("agent/graph.py",
              '''        # TODO: EDGES — delete me, uncomment the base graph below (Codelab: the policy gate step, the EDGES hole)
        # (START, scan_trends, join_research),
        # (START, read_backcatalog, join_research),
        # (join_research, propose_directions, direction_gate,
        #  persist_direction, policy_check),
        # (policy_check, {"OK": scripter, "BLOCK": quarantine}),
        # (scripter, store_script),''',
              '''        (START, scan_trends, join_research),
        (START, read_backcatalog, join_research),
        (join_research, propose_directions, direction_gate,
         persist_direction, policy_check),
        (policy_check, {"OK": scripter, "BLOCK": quarantine}),
        (scripter, store_script),'''),

    # Act III · the audience graph joins the fan-out — one edge
    "GRAPH_EDGE": ("agent/graph.py",
                   '''        # TODO: GRAPH_EDGE — delete me, uncomment below: the audience graph joins the fan-out (Codelab: the BigQuery step)
        # (START, read_graph, join_research),''',
                   '''        (START, read_graph, join_research),'''),

    # Act III · the memory bank joins the fan-out — one edge
    "MEMORY_EDGE": ("agent/graph.py",
                    '''        # TODO: MEMORY_EDGE — delete me, uncomment below: the channel's memory joins the fan-out (Codelab: the Memory Bank step)
        # (START, read_memory, join_research),''',
                    '''        (START, read_memory, join_research),'''),

    # S2 · the join is yours
    "JOIN_CONDITION": ("agent/joinlogic.py",
                       '''    raise NotImplementedError("TODO: JOIN_CONDITION — delete me, uncomment the two lines below (Codelab: the publish step)")
    # still = drive.run(drive.pending(desk_sid(st)))
    # human_ok = any(a["kind"] == "thumb" for a in st["lineage"]["approvals"])''',
                       '''    still = drive.run(drive.pending(desk_sid(st)))
    human_ok = any(a["kind"] == "thumb" for a in st["lineage"]["approvals"])'''),

    # S4 · a graph is a lens over tables — one edge is the vocabulary
    "EDGE_TABLE": ("bqgraph/load.py",
                   '''    -- TODO: EDGE_TABLE — delete me, uncomment the watched edge below (Codelab: the BigQuery step)
    -- `{d}.watched` AS watched
    --   KEY (viewer_id, video_id)
    --   SOURCE KEY (viewer_id) REFERENCES viewers (id)
    --   DESTINATION KEY (video_id) REFERENCES videos (id)''',
                   '''    `{d}.watched` AS watched
      KEY (viewer_id, video_id)
      SOURCE KEY (viewer_id) REFERENCES viewers (id)
      DESTINATION KEY (video_id) REFERENCES videos (id)'''),

    # S5 · learned state — the WRITE path
    "GENERATE": ("agent/memory.py",
                 '''    raise NotImplementedError("TODO: GENERATE — delete me, uncomment the write below (Codelab: the Memory Bank step)")
    # op = _cli().agent_engines.memories.generate(
    #     name=name,
    #     direct_memories_source=vt.GenerateMemoriesRequestDirectMemoriesSource(
    #         direct_memories=[{"fact": f} for f in facts]),
    #     scope=SCOPE, config={"wait_for_completion": True})''',
                 '''    op = _cli().agent_engines.memories.generate(
        name=name,
        direct_memories_source=vt.GenerateMemoriesRequestDirectMemoriesSource(
            direct_memories=[{"fact": f} for f in facts]),
        scope=SCOPE, config={"wait_for_completion": True})'''),

}

# codelab section aliases for rescue
SECTIONS = {"s0": ["TOOLS"], "s1a": ["FANOUT_JOIN", "FANOUT_EDGES"], "s1b": ["PROPOSER", "GATE_INPUT", "STAGE2_EDGES"], "s1": ["RESUME"], "s2": ["POLICY_ROUTE", "QUARANTINE", "ROUTER_EDGES", "EDGES", "JOIN_CONDITION"],
            "s4": ["EDGE_TABLE", "GRAPH_EDGE"], "s5": ["GENERATE", "MEMORY_EDGE"]}
