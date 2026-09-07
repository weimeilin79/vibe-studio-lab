import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { In, StepHeader } from "../components/shared";
import { COLORS } from "./colors";
import { SnakeGraph } from "./Overview";

/*
 * Step 10: the whole workflow, and every concept it carries. Hover a node
 * for what it taught and where; the pulse walks the graph the way a run does.
 */

const PURPLE = COLORS.purple;

type Kind = "start" | "func" | "join" | "agent" | "human" | "router" | "task" | "desk";

interface NodeInfo {
  name: string;
  kind: Kind;
  step: string;
  to: string;
  concepts: string[];
}

const NODES: NodeInfo[] = [
  { name: "START", kind: "start", step: "Step 4 · The research fan-out", to: "/step/fan-out/a", concepts: ["Workflow and its edge list", "START: the entry every chain begins at", "A tuple is a chain, a list of tuples is the graph"] },
  { name: "scan_trends", kind: "func", step: "Step 4b · Fan-out", to: "/step/fan-out/b", concepts: ["A function node: node_input in, Event(output=...) out", "Two chains from START run in parallel", "Trends drawn from a pool beside the graph"] },
  { name: "read_backlog", kind: "func", step: "Step 4b · Fan-out", to: "/step/fan-out/b", concepts: ["The creator's notes from a text file", "idea_text: the message that started the run", "The same function in the stage app and in production"] },
  { name: "read_feedback", kind: "func", step: "Step 7 · RAG Engine", to: "/step/rag/a", concepts: ["A RAG Engine corpus: files, passages, embeddings", "retrieval_query: meaning in, meaning out", "Retrieval as a third reader, one more edge into the join"] },
  { name: "join_research", kind: "join", step: "Step 4b · Fan-out", to: "/step/fan-out/b", concepts: ["JoinNode waits for every incoming edge", "Its output is one dict, keyed by node name", "Adding a reader changes one line"] },
  { name: "propose_directions", kind: "agent", step: "Step 4c · The agent node", to: "/step/fan-out/c", concepts: ["An Agent as a node, single_turn", "output_schema: four typed candidates in one call", "Step 6: before_model_callback recall_taste appends Memory Bank"] },
  { name: "direction_gate", kind: "human", step: "Step 4d · Human in the loop", to: "/step/fan-out/d", concepts: ["RequestInput suspends the graph", "response_schema, payload, interrupt_id", "Resume by function_response with the call's id"] },
  { name: "persist_direction", kind: "func", step: "Step 5a · State", to: "/step/policy-gate/a", concepts: ["Event(state=...) writes shared state", "parameter_binding: candidates arrives by name", "user: keys outlive the session; runs/state.json is the app's copy"] },
  { name: "policy_check", kind: "router", step: "Step 5b · The router node", to: "/step/policy-gate/b", concepts: ["A router: Event(route=...) picks the edge", "Policy as data: policy_words.txt read at decision time", "A dict target maps route names to nodes"] },
  { name: "scripter", kind: "agent", step: "Step 5b · The router node", to: "/step/policy-gate/b", concepts: ["An agent node after the gate", "Step 6: after_agent_callback remember_pick writes the pick to Memory Bank"] },
  { name: "quarantine", kind: "task", step: "Step 5c · Agent modes", to: "/step/policy-gate/c", concepts: ["mode='task': tools until finish_task", "find_policy_hits and suggest_replacement", "A refused direction repaired, then rerouted to the scripter"] },
  { name: "render_desk", kind: "desk", step: "Step 8 · The video", to: "/step/video/a", concepts: ["LongRunningFunctionTool and the pending receipt", "The workflow suspends at an agent node", "Delivered by id from another process, after a restart"] },
  { name: "store_video", kind: "func", step: "Step 8b · render_desk in the graph", to: "/step/video/b", concepts: ["The delivered render into shared state", "runs/state.json as the bridge between processes", "The run ends with a clip"] },
];



const KIND_LABEL: Record<Kind, string> = { start: "", func: "function", join: "join", agent: "agent", human: "your pick", router: "router", task: "agent (mode: task)", desk: "long-running tool" };

const STEP_ROWS = [
  { step: "3 · A single prompt", covered: "An Agent with function tools; function_call and function_response events; why prose is a poor interface between steps" },
  { step: "4 · Fan-out and the human pause", covered: "Workflow, START, edges as tuples; JoinNode; an Agent as a node with output_schema; RequestInput with response_schema, payload and interrupt_id" },
  { step: "5 · State and the policy gate", covered: "Event(state=...), parameter binding, the user: prefix; a router node; policy as data; agent modes and a task agent with tools" },
  { step: "6 · Memory Bank", covered: "Scope, extraction, consolidation, custom topics; memories.generate and retrieve; before_model_callback and after_agent_callback" },
  { step: "7 · RAG Engine", covered: "A corpus, chunking, an embedding model, retrieval by meaning; a retrieval node as one more edge into the join; a model that varies" },
  { step: "8 · The video", covered: "LongRunningFunctionTool, the pending receipt, a workflow suspended at an agent node, resume by id from another process, Veo with retries" },
  { step: "9 · Deploy", covered: "The Runner and run_async; an app on top with one SSE stream; the finished agent as a byte-identical copy; a container on Cloud Run" },
];

export function Summary() {
  const [hover, setHover] = useState<string | null>(null);
  const node = NODES.find((n) => n.name === hover) ?? null;
  return (
    <div className="space-y-12">
      <StepHeader
        kicker="Step 10 · Summary"
        color={PURPLE}
        title="The finished workflow and every concept in it."
        blurb="This is the graph you built, node by node, from a single prompt to a published clip. Hover a node for what it taught and where. The pulse walks it the way a run does."
      />

      <In delay={0.1}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">The workflow</p>
          <SnakeGraph hover={hover === "START" ? "__START__" : hover} onHover={(n) => setHover(n === "__START__" ? "START" : n)} label="The whole workflow, the way the app draws it: START fans out to scan_trends, read_backlog and read_feedback, then join_research, propose_directions, direction_gate, persist_direction, policy_check routing OK to scripter and BLOCK to quarantine, render_desk, store_video. Hover a node for what it taught." />
          <div className="mt-4 min-h-[112px] rounded-2xl border border-hairline bg-overlay p-4">
            {node ? (
              <motion.div key={node.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm text-fg">
                    {node.name} <span className="text-fg-muted">· {KIND_LABEL[node.kind] || "entry"}</span>
                  </p>
                  <Link to={node.to} className="font-mono text-[11px] text-vibe-cyan hover:underline">
                    {node.step} →
                  </Link>
                </div>
                <ul className="mt-2 grid gap-1 text-sm text-fg-muted md:grid-cols-3">
                  {node.concepts.map((c) => (
                    <li key={c} className="rounded-xl border border-hairline bg-card px-3 py-2">
                      {c}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ) : (
              <p className="text-sm text-fg-muted">Hover a node. Each one links back to the step that built it.</p>
            )}
          </div>
        </section>
      </In>

      <In delay={0.2}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Step by step</p>
          <h2 className="font-display mt-2 text-2xl">What each step covered.</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                  <th className="pb-2 pr-4">Step</th>
                  <th className="pb-2">Concepts</th>
                </tr>
              </thead>
              <tbody>
                {STEP_ROWS.map((r) => (
                  <tr key={r.step} className="border-t border-hairline align-top">
                    <td className="py-2 pr-4 font-semibold text-fg">{r.step}</td>
                    <td className="py-2 text-fg-muted">{r.covered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </In>

      <In delay={0.3}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Design rules the graph follows</p>
          <ul className="mt-3 grid gap-2 text-sm text-fg-muted md:grid-cols-2">
            <li className="rounded-2xl border border-hairline bg-overlay p-3">Graphs pause for people and for receipts, never for a wait. RequestInput and the pending tool call both suspend the run; nothing stays alive on its behalf.</li>
            <li className="rounded-2xl border border-hairline bg-overlay p-3">Every resume is one function_response carrying the call's id, whoever sends it: a page, a console, another process, after a restart.</li>
            <li className="rounded-2xl border border-hairline bg-overlay p-3">Nodes share state by key name. candidates, direction, render_url move through the graph without being passed between nodes.</li>
            <li className="rounded-2xl border border-hairline bg-overlay p-3">Routing is plain code and policy is data. The gate is a function and a text file, decided before any money is spent.</li>
            <li className="rounded-2xl border border-hairline bg-overlay p-3">Context that belongs to one agent rides a callback on that agent. Research that produces data before the model runs is a node in the fan-out.</li>
            <li className="rounded-2xl border border-hairline bg-overlay p-3">The app owns the loop, not the graph: a Runner drives it, an event stream shows it, the graph itself does not know a page exists.</li>
          </ul>
        </section>
      </In>

      <In delay={0.4}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Where to go next</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-muted">
            <li>Replace DatabaseSessionService with VertexAiSessionService, so the app's sessions live beside the Memory Bank and instances can come and go.</li>
            <li>Deliver the render by webhook instead of polling: the same function_response, sent by whoever hears from Veo first.</li>
            <li>Add a second person to the graph: a reviewer's RequestInput before publish.</li>
            <li>Give the audience's comments a way in: append new comments to the corpus after each publish, and watch the next run lean.</li>
          </ul>
        </section>
      </In>
    </div>
  );
}
