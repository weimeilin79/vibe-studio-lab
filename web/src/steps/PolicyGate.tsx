import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, RefreshCw } from "lucide-react";
import { In, StepHeader } from "../components/shared";
import { CatchUp } from "../components/CatchUp";
import { api, useRunEvents } from "../lib/api";
import type { Stage3Status } from "../lib/types";
import { COLORS, tint } from "./colors";
import { CheckRow, DEFAULT_IDEA, EditPanel, RunPanel, VerifyPanel } from "./FanOut";

/*
 * Step 5, in parts:
 *   5a  state: persist_direction reads candidates from shared state by parameter
 *       name and writes the pick back with Event(state=...); append it, write the
 *       state, run, open the State tab
 *   5b  the router node: policy_check returns a route, the edge dict maps it;
 *       finish the router's return, wire the router, run both routes
 *   5c  agent modes; quarantine rebuilt as a task-mode agent that replaces the
 *       refused words with tools until the direction is clean, then hands it to
 *       the scripter; reroute quarantine -> scripter
 */

const RED = COLORS.red;
const AMBER = COLORS.amber;
const CYAN = COLORS.cyan;
const PURPLE = COLORS.purple;
const GREEN = COLORS.green;

type Part = "a" | "b" | "c";
const PARTS: { id: Part; label: string }[] = [
  { id: "a", label: "State" },
  { id: "b", label: "The router node" },
  { id: "c", label: "Agent modes and the task node" },
];

export function PolicyGate() {
  const { part: partParam } = useParams();
  const part: Part = PARTS.some((p) => p.id === partParam) ? (partParam as Part) : "a";
  const idx = PARTS.findIndex((p) => p.id === part);
  return (
    <div className="space-y-12">
      {part === "a" && <StateNode />}
      {part === "b" && <RouterNode />}
      {part === "c" && <TaskNode />}
      <div className="flex items-center justify-between border-t border-hairline pt-6">
        {idx > 0 ? (
          <Link to={`/step/policy-gate/${PARTS[idx - 1].id}`} className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-fg-muted hover:text-fg">
            ← 5{PARTS[idx - 1].id} · {PARTS[idx - 1].label}
          </Link>
        ) : (
          <span />
        )}
        {idx < PARTS.length - 1 && (
          <Link to={`/step/policy-gate/${PARTS[idx + 1].id}`} className="flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-black" style={{ background: RED }}>
            Continue to 5{PARTS[idx + 1].id} · {PARTS[idx + 1].label} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

function useStage3() {
  const [status, setStatus] = useState<Stage3Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);
  const { snapshot } = useRunEvents();
  const check = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await api.labStage3());
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    check();
  }, [check]);
  useEffect(() => {
    if (snapshot) check();
  }, [snapshot?.updated_at, check]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const t = setInterval(check, 4000);
    return () => clearInterval(t);
  }, [open, check]);
  return { status, checking, check, open, setOpen };
}

function LoadCheck({ intro }: { intro: string }) {
  const [load, setLoad] = useState<{ ok: boolean; edges?: number; error: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      setLoad(await api.labStage3Load());
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="rounded-3xl border border-hairline bg-card p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Before you run</p>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{intro}</p>
        </div>
        <button onClick={run} className="flex items-center gap-2 rounded-xl border border-hairline bg-overlay px-4 py-2 font-mono text-xs text-fg-muted hover:text-fg">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Check the workflow loads
        </button>
      </div>
      {load && (
        <div className="mt-3 rounded-xl border p-3 font-mono text-[11.5px]" style={load.ok ? { borderColor: tint(GREEN, 0.4), color: GREEN, background: tint(GREEN, 0.06) } : { borderColor: tint(RED, 0.4), color: RED, background: tint(RED, 0.06) }}>
          {load.ok ? `loads · ${load.edges} edges` : load.error}
        </div>
      )}
    </section>
  );
}

/** The router and its two exits; with reroute, the 5c edge back to the scripter. */
function RouterFigure({ reroute }: { reroute: boolean }) {
  const box = { fill: "var(--overlay)", stroke: "var(--hairline)" };
  return (
    <figure className="m-0">
      <svg viewBox="0 0 620 190" role="img" aria-label={reroute ? "persist_direction feeds policy_check, a router. OK goes to scripter, BLOCK goes to quarantine, and quarantine now continues to scripter." : "persist_direction feeds policy_check, a router. OK goes to scripter, BLOCK goes to quarantine, where the run ends."} className="h-auto w-full text-fg" style={{ maxWidth: "100%" }}>
        <defs>
          <marker id="rt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <rect x="10" y="82" width="132" height="26" rx="8" {...box} />
        <text x="76" y="99" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle" fill="currentColor">persist_direction</text>
        <line x1="142" y1="95" x2="188" y2="95" stroke="currentColor" strokeWidth="1.2" markerEnd="url(#rt-arrow)" />
        {/* the diamond */}
        <polygon points="260,50 330,95 260,140 190,95" fill={tint(AMBER, 0.12)} stroke={AMBER} strokeWidth="1.2" />
        <text x="260" y="92" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle" fill={AMBER}>policy_check</text>
        <text x="260" y="106" fontSize="8.5" fontFamily="var(--font-mono)" textAnchor="middle" fill="currentColor" opacity="0.7">a function node</text>
        {/* OK */}
        <path d="M330 95 C 370 95, 380 40, 430 40" fill="none" stroke={GREEN} strokeWidth="1.2" markerEnd="url(#rt-arrow)" />
        <text x="372" y="56" fontSize="9.5" fontFamily="var(--font-mono)" fill={GREEN}>route="OK"</text>
        <rect x="432" y="27" width="108" height="26" rx="8" {...box} />
        <text x="486" y="44" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle" fill="currentColor">scripter</text>
        <text x="486" y="66" fontSize="8.5" fontFamily="var(--font-mono)" textAnchor="middle" fill="currentColor" opacity="0.6">agent node</text>
        {/* BLOCK */}
        <path d="M330 95 C 370 95, 380 150, 430 150" fill="none" stroke={RED} strokeWidth="1.2" markerEnd="url(#rt-arrow)" />
        <text x="366" y="142" fontSize="9.5" fontFamily="var(--font-mono)" fill={RED}>route="BLOCK"</text>
        <rect x="432" y="137" width="108" height="26" rx="8" fill={reroute ? tint(PURPLE, 0.12) : "var(--overlay)"} stroke={reroute ? PURPLE : "var(--hairline)"} />
        <text x="486" y="154" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle" fill={reroute ? PURPLE : "currentColor"}>quarantine</text>
        <text x="486" y="176" fontSize="8.5" fontFamily="var(--font-mono)" textAnchor="middle" fill="currentColor" opacity="0.6">{reroute ? "task agent: clean the words" : "placeholder: says blocked, run ends"}</text>
        {reroute && (
          <>
            <path d="M540 150 C 590 150, 590 40, 542 40" fill="none" stroke={PURPLE} strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#rt-arrow)" />
            <text x="598" y="99" fontSize="9" fontFamily="var(--font-mono)" fill={PURPLE} textAnchor="middle" transform="rotate(90 598 99)">cleaned</text>
          </>
        )}
      </svg>
      <figcaption className="mt-2 text-xs text-fg-muted">
        {reroute ? "After 5c: the refused direction is cleaned and continues to the scripter instead of ending the run." : "The router returns a route name; the edge dict maps each name to a node. In 5b a blocked direction ends the run."}
      </figcaption>
    </figure>
  );
}

/* ───────────────────────── 5a ───────────────────────── */

const STATE_POINTS = [
  { t: "One dict for the run", d: "Shared state is a dict every node can read and write. Each write is an Event(state=...) delta; ADK merges the deltas, stores each as a row in the session, and the dev UI shows the merged result in its State tab." },
  { t: "Read by parameter name", d: "A function node binds parameters from state by name. persist_direction's signature asks for candidates and constraints; nobody passes them. The gate wrote candidates, so it arrives." },
  { t: "State is not output", d: "Output goes to the next node only. State is for any node, now or later: the scripter reads {constraints}, and step 6 reads direction and angle." },
  { t: "The user: prefix", d: "A key that starts with user: is stored on the user, not the session. It survives into the next run and the next session. Here: the last direction picked." },
  { t: "Two copies, two readers", d: "Session state is ADK's: the session store, the State tab, the next node's parameters. runs/state.json is the app's: _record_brief writes the same direction there, and the app that drives the workflow in step 9 reads it after the run without opening a session." },
];

const CODE_PERSIST = `# agent/graph.py
def persist_direction(node_input, candidates: list = [], constraints: str = ""):
    ni = node_input if isinstance(node_input, dict) else {}
    raw = ni.get("pick")
    pick = str(raw).strip() if raw is not None else ""
    if candidates:
        i = int(pick) - 1 if pick.isdigit() else 0
        chosen = candidates[max(0, min(len(candidates) - 1, i))]
    else:
        chosen = {"title": "untitled", "angle": "", "evidence": []}
    hook = chosen.get("hook") or " ".join(chosen["title"].split()[:4])
    yield Event(state={"direction": chosen["title"], "angle": chosen.get("angle", ""),
                       "hook": hook, "constraints": constraints or "(none yet)",
                       "user:prefs": {"last_direction": chosen["title"]}})
    _record_brief(chosen, hook)
    yield Event(output=chosen)


def _record_brief(chosen: dict, hook: str) -> None:
    """The driver's copy, in runs/state.json: the file the run shares with
    code outside ADK. The delivery writes the render there in step 8, and
    the app reads it after the run."""
    st = state.load()
    st["brief"] = {"topic": chosen["title"], "angle": chosen.get("angle", ""),
                   "hook": hook, "evidence": chosen.get("evidence", [])}
    st["direction"] = chosen["title"]
    st["hook"] = hook
    state.save(st)`;

function StateNode() {
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [hintA, setHintA] = useState(0);
  const [hintB, setHintB] = useState(0);
  const { status, checking, check, open, setOpen } = useStage3();
  const persistOk = status?.persist_wired ?? false;
  const writeOk = status?.state_write_wired ?? false;
  const keys = status?.state_keys ?? [];
  const wrote = !!status?.direction;

  return (
    <div className="space-y-12">
      <StepHeader
        kicker="Step 5a · State"
        color={RED}
        title="Where a run keeps what it knows."
        blurb="Your pick is one number. The rest of the graph needs the direction it names, and later nodes need it without being next in line. Shared state is how a run remembers within itself; this part writes to it and reads from it."
      />

      <CatchUp needs={["GATE_INPUT"]} color={RED} />

      <In delay={0.1}>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STATE_POINTS.map((p, i) => (
            <motion.div key={p.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="rounded-3xl border border-hairline bg-card p-5">
              <p className="text-sm font-semibold" style={{ color: RED }}>
                {p.t}
              </p>
              <p className="mt-2 text-sm text-fg-muted">{p.d}</p>
            </motion.div>
          ))}
        </section>
      </In>

      <In delay={0.2}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">The node</p>
          <h2 className="font-display mt-2 text-2xl">persist_direction: read the pick, write the direction.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            The gate's answer, <code className="font-mono text-fg">{"{"}"pick": "2"{"}"}</code>, arrives as <code className="font-mono text-fg">node_input</code>.
            The <code className="font-mono text-fg">candidates</code> parameter is bound from state, where the gate wrote the four candidates in 4d.
            The function resolves the number to a candidate, then does three things with it: writes the direction to shared state, records it in{" "}
            <code className="font-mono text-fg">runs/state.json</code> through <code className="font-mono text-fg">_record_brief</code>, and outputs the
            candidate dict for the next node. The state write is the line you fill in. <code className="font-mono text-fg">_record_brief</code> is the
            second copy: a file on disk, outside ADK, holding the brief (topic, angle, hook, evidence) and the direction. In step 8 the delivery process writes the finished render into the same file and{" "}
            <code className="font-mono text-fg">store_video</code> reads it back into shared state; the app of step 9 reads the direction after the run without
            opening a session. Session state lives and dies with the session; the file is what the rest of the program sees. This step's app is{" "}
            <code className="font-mono text-fg">stage3_router</code>; the function lives in <code className="font-mono text-fg">agent/graph.py</code>.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-hairline bg-input">
            <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">agent/graph.py · persist_direction and _record_brief, complete</div>
            <pre className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
              <code>{CODE_PERSIST}</code>
            </pre>
          </div>
        </section>
      </In>

      <In delay={0.3}>
        <EditPanel
          label="Edit 1 of 2"
          title="Append persist_direction to the chain."
          intro={<>Only the <code className="font-mono text-fg">Workflow</code> is shown. The chain ends at the gate; add <code className="font-mono text-fg">persist_direction</code> after it so the answer has a reader.</>}
          pill={status ? (persistOk ? "persist_direction in the chain ✓" : `chain ends at ${status.chain[status.chain.length - 1] ?? "…"}`) : "…"}
          ok={persistOk}
          hint={hintA}
          setHint={setHintA}
          hint1={<>One more name at the end of the third tuple, after <code className="font-mono">direction_gate</code>.</>}
          hint2={`    edges=[(START, scan_trends, join_research),
           (START, read_backlog, join_research),
           (join_research, propose_directions, direction_gate,
            persist_direction)])`}
          path="stage3_router/agent.py"
          symbol="root_agent"
          pattern={/direction_gate\)\]\)|persist_direction\)\]\)/}
          onSaved={check}
        />
      </In>

      <In delay={0.35}>
        <EditPanel
          label="Edit 2 of 2"
          title="Write the direction to state."
          intro={<>Only <code className="font-mono text-fg">persist_direction</code> is shown. Replace the TODO line with a <code className="font-mono text-fg">yield Event(state={"{...}"})</code> carrying five keys: <code className="font-mono text-fg">direction</code>, <code className="font-mono text-fg">angle</code>, <code className="font-mono text-fg">hook</code>, <code className="font-mono text-fg">constraints</code>, and <code className="font-mono text-fg">user:prefs</code>.</>}
          pill={status ? (writeOk ? "state write in place ✓" : "no Event(state=...) yet") : "…"}
          ok={writeOk}
          hint={hintB}
          setHint={setHintB}
          hint1={<>The values are already computed above the line: <code className="font-mono">chosen["title"]</code>, <code className="font-mono">chosen.get("angle", "")</code>, <code className="font-mono">hook</code>, <code className="font-mono">constraints or "(none yet)"</code>. For <code className="font-mono">user:prefs</code>, a dict with <code className="font-mono">last_direction</code>.</>}
          hint2={`    yield Event(state={"direction": chosen["title"], "angle": chosen.get("angle", ""),
                       "hook": hook, "constraints": constraints or "(none yet)",
                       "user:prefs": {"last_direction": chosen["title"]}})`}
          path="agent/graph.py"
          symbol="persist_direction"
          pattern={/TODO: PERSIST_STATE|Event\(state=/}
          onSaved={check}
        />
      </In>

      <In delay={0.4}>
        <LoadCheck intro="Save both edits, then click the button. It loads your saved file the way adk web will and tells you either that it loads or what ADK objects to." />
      </In>

      <In delay={0.45}>
        <RunPanel
          app="stage3_router"
          open={open}
          setOpen={setOpen}
          title="Run it, answer, then open the State tab."
          intro="One model call, for the proposer. After you answer the form, persist_direction runs and the run ends."
          idea={idea}
          setIdea={setIdea}
          steps={[
            "Answer the form with 2. A State: direction chip follows the gate, then the run ends. The last event is persist_direction's output: the candidate you picked, as a dict.",
            "Click the State tab on the left. candidates was written by the gate; direction, angle, hook, constraints, and user:prefs were written by your line. The verify panel below reads the same rows.",
          ]}
        />
      </In>

      <In delay={0.5}>
        <VerifyPanel checking={checking} onCheck={check} intro="Read from agent/graph.py, this step's app file, and the latest stage3_router session's state.">
          <CheckRow ok={persistOk} label="persist_direction follows the gate in the chain">
            {status ? (persistOk ? status.chain.join(" → ") : "Edit 1 above.") : "…"}
          </CheckRow>
          <CheckRow ok={writeOk} label="persist_direction yields Event(state=...)">
            {status ? (writeOk ? "Found in agent/graph.py." : "Edit 2 above.") : "…"}
          </CheckRow>
          <CheckRow ok={wrote} label="state.direction holds your pick">
            {status?.direction ? `${status.direction}${status.angle ? ` · ${status.angle.slice(0, 60)}` : ""}` : "Not in state yet."}
          </CheckRow>
          <CheckRow ok={!!status?.user_prefs?.last_direction} label="state has user:prefs">
            {status?.user_prefs?.last_direction ? `last_direction: ${status.user_prefs.last_direction}` : "Not in state yet."}
          </CheckRow>
          {keys.length ? (
            <li className="md:col-span-2 rounded-2xl border border-hairline bg-overlay p-3 font-mono text-[11px] text-fg-muted">
              state keys: {keys.join(" · ")}
            </li>
          ) : null}
        </VerifyPanel>
      </In>
    </div>
  );
}

/* ───────────────────────── 5b ───────────────────────── */

const CODE_ROUTER_SAMPLE = `# a sample router
def length_check(node_input):
    too_long = len(node_input.get("title", "")) > 60
    return Event(output=node_input,
                 route="TRIM" if too_long else "PASS")`;

const CODE_SCRIPT_INSTRUCTION = `# agent/graph.py
SCRIPT_INSTRUCTION = (
    "Write the production script for the approved video "
    "direction. The message you received is the direction "
    "as JSON: title, angle, hook."
    "Channel constraints: {constraints}"
    "Deliver: title, description, 3-5 tags, an opening_line, "
    "and EXACTLY 3 shots ...")`;

const CODE_SCRIPT_SCHEMA = `# agent/schemas.py
class Script(BaseModel):
    title: str
    description: str
    tags: list[str]
    opening_line: str
    conclusion_first: bool
    shots: list[Shot]`;

const CODE_SCRIPTER = `# stage3_router/agent.py
scripter = Agent(
    name="scripter",
    model=config.MODEL,
    instruction=SCRIPT_INSTRUCTION,
    output_schema=Script)`;

const CODE_QUARANTINE_STUB = `# stage3_router/agent.py
def quarantine(node_input):
    return Event(
        output={"blocked": True,
                "title": node_input.get("title", "")},
        message="blocked: the channel's policy "
                "refused this direction")`;

const ROUTER_POINTS = [
  { t: "A function node with a route", d: "A router is a plain function like the readers. Its Event carries a route name next to its output, and the graph follows the edge with that name." },
  { t: "The edge dict", d: "A tuple whose target is a dict maps each route name to a node. The names are yours; the router and the edge list have to agree on them." },
  { t: "Deterministic, before any spend", d: "A word list and a regex. The same direction gives the same route every time, at no cost, and the matched words are recorded. The gate sits before the scripter, the renders, and the publish." },
];

function RouterNode() {
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [hintA, setHintA] = useState(0);
  const [hintB, setHintB] = useState(0);
  const { status, checking, check, open, setOpen } = useStage3();
  const routeOk = status?.policy_route_wired ?? false;
  const routerOk = (status?.router_wired ?? false) && (status?.routes_wired ?? false);

  return (
    <div className="space-y-12">
      <StepHeader
        kicker="Step 5b · The router node"
        color={RED}
        title="A decision the model does not make."
        blurb="Step 3 asked the model to refuse blacklisted subjects and it could be talked out of it. Here the refusal is a node: policy_check reads the chosen direction, returns a route, and the edge list decides what runs next."
      />

      <CatchUp needs={["GATE_INPUT", "PERSIST_STATE"]} color={RED} />

      <In delay={0.1}>
        <section className="grid gap-3 md:grid-cols-3">
          {ROUTER_POINTS.map((p, i) => (
            <motion.div key={p.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="rounded-3xl border border-hairline bg-card p-5">
              <p className="text-sm font-semibold" style={{ color: RED }}>
                {p.t}
              </p>
              <p className="mt-2 text-sm text-fg-muted">{p.d}</p>
            </motion.div>
          ))}
        </section>
      </In>

      <In delay={0.2}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Where the graph stands</p>
          <h2 className="font-display mt-2 text-2xl">The chain ends at persist_direction.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            After 5a the chain resolves your pick into the chosen candidate, a dict with a title, an angle, and a hook, and its output is that
            dict. The router reads it next. The router is missing its last line. The two nodes it routes to are defined below.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <RouterFigure reroute={false} />
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">Sample router</div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed text-fg">
                <code>{CODE_ROUTER_SAMPLE}</code>
              </pre>
              <div className="border-t border-hairline px-4 py-2 font-mono text-[11.5px] text-fg">
                <span className="text-fg-muted"># the edge that reads a route:</span>
                <br />
                (length_check, {"{"}"TRIM": shorten, "PASS": scripter{"}"})
              </div>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-fg-muted">
            The return does the routing: <code className="font-mono text-fg">Event(output=..., route=...)</code>. The output goes to whichever
            node the route selects, and the edge list names the routes. The real router, <code className="font-mono text-fg">policy_check</code>{" "}
            in <code className="font-mono text-fg">agent/graph.py</code>, computes <code className="font-mono text-fg">bad</code>, the list of refused
            words found in the title and angle, records it, and stops short of returning.
          </p>
        </section>
      </In>

      <In delay={0.3}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">The two destinations</p>
          <h2 className="font-display mt-2 text-2xl">The scripter, and a placeholder.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            <code className="font-mono text-fg">scripter</code> is an agent node like the proposer in 4c: one call, one typed answer. Its message
            is the approved direction as JSON, its instruction is <code className="font-mono text-fg">SCRIPT_INSTRUCTION</code> in{" "}
            <code className="font-mono text-fg">agent/graph.py</code>, and its output schema is <code className="font-mono text-fg">Script</code>: a
            title, a description, tags, an opening line, and exactly three shots for the render model.{" "}
            <code className="font-mono text-fg">quarantine</code> is the other exit. It is a placeholder function that reports the block and ends
            the run; 5c replaces it.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">The scripter · an agent node</div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed text-fg">
                <code>{CODE_SCRIPTER}</code>
              </pre>
            </div>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">quarantine · a placeholder function node</div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed text-fg">
                <code>{CODE_QUARANTINE_STUB}</code>
              </pre>
            </div>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">The scripter's instruction · abridged</div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed text-fg">
                <code>{CODE_SCRIPT_INSTRUCTION}</code>
              </pre>
            </div>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">The scripter's output schema</div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed text-fg">
                <code>{CODE_SCRIPT_SCHEMA}</code>
              </pre>
            </div>
          </div>
        </section>
      </In>

      <In delay={0.35}>
        <EditPanel
          label="Edit 1 of 2"
          title="Finish the router."
          intro={<>Only <code className="font-mono text-fg">policy_check</code> is shown. Replace the TODO line with the return: an <code className="font-mono text-fg">Event</code> whose <code className="font-mono text-fg">output</code> is <code className="font-mono text-fg">node_input</code> and whose <code className="font-mono text-fg">route</code> is <code className="font-mono text-fg">"BLOCK"</code> when <code className="font-mono text-fg">bad</code> has anything in it and <code className="font-mono text-fg">"OK"</code> otherwise.</>}
          pill={status ? (routeOk ? "router returns a route ✓" : "no return with a route yet") : "…"}
          ok={routeOk}
          hint={hintA}
          setHint={setHintA}
          hint1={<>Same shape as the sample above: <code className="font-mono">return Event(output=node_input, route=...)</code>, with a conditional expression on <code className="font-mono">bad</code> for the route.</>}
          hint2={`    return Event(output=node_input, route="BLOCK" if bad else "OK")`}
          path="agent/graph.py"
          symbol="policy_check"
          pattern={/TODO: POLICY_ROUTE|return Event/}
          onSaved={check}
        />
      </In>

      <In delay={0.45}>
        <EditPanel
          label="Edit 2 of 2"
          title="Wire the router."
          intro={<>Only the <code className="font-mono text-fg">Workflow</code> is shown. Append <code className="font-mono text-fg">policy_check</code> after <code className="font-mono text-fg">persist_direction</code>, then add the edge whose target is a dict: <code className="font-mono text-fg">OK</code> to the scripter, <code className="font-mono text-fg">BLOCK</code> to quarantine.</>}
          pill={status ? (routerOk ? "router wired ✓" : status.router_wired ? "policy_check in the chain; add the route dict" : `chain ends at ${status.chain[status.chain.length - 1] ?? "…"}`) : "…"}
          ok={routerOk}
          hint={hintB}
          setHint={setHintB}
          hint1={<>Two changes: <code className="font-mono">policy_check</code> becomes the last name of the third chain, and a fourth tuple starts with <code className="font-mono">policy_check</code> and ends with the dict from the figure above.</>}
          hint2={`    edges=[(START, scan_trends, join_research),
           (START, read_backlog, join_research),
           (join_research, propose_directions, direction_gate,
            persist_direction, policy_check),
           (policy_check, {"OK": scripter, "BLOCK": quarantine})])`}
          path="stage3_router/agent.py"
          symbol="root_agent"
          pattern={/persist_direction|policy_check|"OK"/}
          onSaved={check}
        />
      </In>

      <In delay={0.5}>
        <LoadCheck intro="Save both edits above, then click the button. It loads your saved file the way adk web will and tells you either that it loads or what ADK objects to." />
      </In>

      <In delay={0.55}>
        <RunPanel
          app="stage3_router"
          open={open}
          setOpen={setOpen}
          title="Run both routes."
          intro="Two runs. Each costs one model call for the proposer, and the OK route costs one more for the scripter."
          idea={idea}
          setIdea={setIdea}
          steps={[
            "Answer the form with 1. policy_check's event shows route: OK, the scripter runs, and its event holds a Script: a title, tags, an opening line, and three shots.",
            "Start a new session and answer with 4. policy_check shows route: BLOCK, quarantine reports the block, and the run ends. Nothing was scripted.",
          ]}
        />
      </In>

      <In delay={0.6}>
        <VerifyPanel checking={checking} onCheck={check} intro="Read from agent/graph.py, this step's app file, and its sessions in runs/sessions.db.">
          <CheckRow ok={routeOk} label="policy_check returns an Event with a route">
            {status ? (routeOk ? "Found in agent/graph.py." : "Edit 1 above.") : "…"}
          </CheckRow>
          <CheckRow ok={routerOk} label="policy_check is in the chain with both routes">
            {status ? (routerOk ? `${status.chain.join(" → ")} → OK | BLOCK` : "Edit 2 above.") : "…"}
          </CheckRow>
          <CheckRow ok={!!status && status.ok_runs > 0 && !!status.script_title} label="An OK run reached the scripter">
            {status?.script_title ? `script title: ${status.script_title}` : `${status?.ok_runs ?? 0} OK route${status?.ok_runs === 1 ? "" : "s"} so far`}
          </CheckRow>
          <CheckRow ok={!!status && status.block_runs > 0 && status.nodes_ran.includes("quarantine")} label="A BLOCK run reached quarantine">
            {status ? (status.block_runs > 0 ? `${status.block_runs} BLOCK route${status.block_runs === 1 ? "" : "s"}${status.blocked_message ? ` · "${status.blocked_message}"` : ""}` : "Answer a run with 4.") : "…"}
          </CheckRow>
        </VerifyPanel>
      </In>
    </div>
  );
}

/* ───────────────────────── 5c ───────────────────────── */

const MODES = [
  { mode: "chat", color: CYAN, who: "The step 3 agent, a root agent.", what: "A conversation. Each user message is a turn; the model decides when to call tools, when to ask, and when to stop. Required for a root agent; not allowed after another node." },
  { mode: "single_turn", color: AMBER, who: "propose_directions, scripter.", what: "One model call, no conversation. Input from the previous node, one structured object out. The default for an agent used as a node." },
  { mode: "task", color: PURPLE, who: "quarantine, from now on.", what: "The model works with its tools for as many calls as it needs and ends by calling the built-in finish_task tool. What it hands to finish_task, typed by output_schema, is the node's output." },
];

const CODE_TOOLS = `"""Tools for the quarantine node (step 5b).

The node is a task-mode agent: it calls these until find_policy_hits comes
back clean, then calls finish_task with the cleaned direction. Both tools are
plain functions; ADK reads the signature and the docstring to describe them
to the model.
"""
from __future__ import annotations

import re

from . import config
from .graph import policy_words

REPLACEMENTS_FILE = config.ROOT / "agent" / "policy_replacements.txt"


def find_policy_hits(text: str) -> dict:
    """Which refused words appear in \`text\`. Matches whole words and phrases
    from agent/policy_words.txt, case-insensitive.

    Returns {"hits": [...], "clean": bool}. clean is true when hits is empty.
    """
    low = text.lower()
    hits = [w for w in policy_words()
            if re.search(rf"\\b{re.escape(w)}\\b", low)]
    return {"hits": hits, "clean": not hits}


def _replacements() -> dict[str, str]:
    out = {}
    for line in REPLACEMENTS_FILE.read_text().splitlines():
        if "=>" in line and not line.strip().startswith("#"):
            bad, good = line.split("=>", 1)
            out[bad.strip().lower()] = good.strip()
    return out


def suggest_replacement(word: str) -> dict:
    """The channel's approved stand-in for a refused word, read from
    agent/policy_replacements.txt.

    Returns {"word", "replacement", "listed"}. When the word has no entry,
    listed is false and replacement is a hint to pick a synonym yourself.
    """
    table = _replacements()
    key = word.strip().lower()
    if key in table:
        return {"word": word, "replacement": table[key], "listed": True}
    return {"word": word, "listed": False,
            "replacement": "(no entry: pick a gentle synonym, keep the scene)"}`;

const CODE_REPLACEMENTS = `# agent/policy_replacements.txt
# Stand-ins for refused words, one per line: refused => replacement.
# suggest_replacement reads this file when the quarantine node asks.
competitor => friendly rival
scam => mystery
revenge => rematch
humiliate => surprise
fake => homemade
dangerous stunt => careful experiment
hoax => rumor
theft => heist game
fraud => mix-up
cruelty => mischief`;

const CODE_QUARANTINE_INSTRUCTION = `# agent/graph.py
QUARANTINE_INSTRUCTION = (
    "The channel's policy refused the direction you received. "
    "The message is the direction as JSON: title, angle, hook. "
    "Make it publishable without changing the scene."
    "1. Call find_policy_hits with the title, and again with "
    "   the angle, to learn which words are refused."
    "2. For every refused word call suggest_replacement and "
    "   rewrite the text with the suggestion."
    "3. Call find_policy_hits again on the rewritten title and "
    "   angle. Repeat steps 2 and 3 until both come back clean."
    "4. Only then call finish_task with the cleaned title, "
    "   angle and hook.")`;

const CODE_CLEANED = `# agent/schemas.py
class CleanedDirection(BaseModel):
    """What quarantine hands to finish_task: the three fields the
    scripter reads, with every refused word replaced."""
    title: str
    angle: str
    hook: str = ""`;

function TaskNode() {
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [hintA, setHintA] = useState(0);
  const [hintB, setHintB] = useState(0);
  const { status, checking, check, open, setOpen } = useStage3();
  const taskOk = status?.quarantine_kind === "task agent";
  const rerouteOk = status?.reroute_wired ?? false;
  const calls = status?.tool_calls ?? {};
  const looped = (calls.find_policy_hits ?? 0) >= 2 && (calls.suggest_replacement ?? 0) >= 1 && (calls.finish_task ?? 0) >= 1;

  return (
    <div className="space-y-12">
      <StepHeader
        kicker="Step 5c · Agent modes and the task node"
        color={RED}
        title="Three ways an agent can run."
        blurb="Every agent in this lab so far answered once. The refused direction needs an agent that works: check the words, replace them, check again, and stop only when the direction is clean. That is a third mode."
      />

      <CatchUp needs={["GATE_INPUT", "PERSIST_STATE", "POLICY_ROUTE"]} color={RED} />

      <In delay={0.1}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Agent modes</p>
          <h2 className="font-display mt-2 text-2xl">chat, single_turn, task.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            <code className="font-mono text-fg">mode</code> is an argument on <code className="font-mono text-fg">Agent</code>. A standalone agent
            has one mode, a conversation. Inside a graph an agent faces the previous node's output instead of a person, and two other modes
            become possible. ADK enforces the fit: a root agent must be <code className="font-mono text-fg">chat</code>, and a{" "}
            <code className="font-mono text-fg">chat</code> agent cannot follow another node.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {MODES.map((m) => (
              <div key={m.mode} className="rounded-2xl border border-hairline bg-overlay p-4">
                <div className="font-mono text-sm font-semibold" style={{ color: m.color }}>
                  {m.mode}
                </div>
                <p className="mt-2 text-xs text-fg-muted">{m.what}</p>
                <p className="mt-2 text-xs">
                  <span className="text-fg-muted">In this lab: </span>
                  {m.who}
                </p>
              </div>
            ))}
          </div>
        </section>
      </In>

      <In delay={0.2}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Quarantine, rebuilt</p>
          <h2 className="font-display mt-2 text-2xl">Replace the refused words, then hand the direction on.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            In 5b a blocked direction ended the run. Now it is repaired. The task agent receives the refused direction as its message, calls{" "}
            <code className="font-mono text-fg">find_policy_hits</code> to learn which words tripped the gate, calls{" "}
            <code className="font-mono text-fg">suggest_replacement</code> for each one, rewrites the text, and checks again. It may take one
            round or several; it decides. When both the title and the angle come back clean it calls{" "}
            <code className="font-mono text-fg">finish_task</code> with the cleaned direction, and that becomes the node's output, in the shape
            the scripter reads.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-hairline bg-input">
            <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">agent/cleanup_tools.py · the two tools</div>
            <pre className="max-h-[460px] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
              <code>{CODE_TOOLS}</code>
            </pre>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
                <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">The replacement list · data, like the policy</div>
                <pre className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
                  <code>{CODE_REPLACEMENTS}</code>
                </pre>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">What finish_task must carry</div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
                <code>{CODE_CLEANED}</code>
              </pre>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-hairline bg-input">
            <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">The instruction · abridged</div>
            <pre className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
              <code>{CODE_QUARANTINE_INSTRUCTION}</code>
            </pre>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-fg-muted">
            Two things make this a task and not a single turn: the agent has tools, and it ends by calling{" "}
            <code className="font-mono text-fg">finish_task</code>. ADK adds that tool itself when <code className="font-mono text-fg">mode="task"</code>{" "}
            is set, and shapes its parameters from <code className="font-mono text-fg">output_schema</code>, so the node's output is a{" "}
            <code className="font-mono text-fg">CleanedDirection</code>, not free text.
          </p>
        </section>
      </In>

      <In delay={0.3}>
        <EditPanel
          label="Edit 1 of 2"
          title="Assemble the task node."
          intro={<>Only <code className="font-mono text-fg">quarantine</code> is shown. Replace the placeholder function from 5b with an <code className="font-mono text-fg">Agent</code>: a name, the model, <code className="font-mono text-fg">mode="task"</code>, the instruction constant, the two tools, and the output schema.</>}
          pill={status ? (taskOk ? "task agent ✓" : status.quarantine_kind ? `quarantine is a ${status.quarantine_kind}` : "quarantine is None") : "…"}
          ok={taskOk}
          hint={hintA}
          setHint={setHintA}
          hint1={<>Six keyword arguments. <code className="font-mono">tools</code> is a list of the two functions, not strings. Delete the whole <code className="font-mono">def</code> from 5a; the symbol keeps its name.</>}
          hint2={`quarantine = Agent(
    name="quarantine",
    model=config.MODEL,
    mode="task",
    instruction=QUARANTINE_INSTRUCTION,
    tools=[find_policy_hits, suggest_replacement],
    output_schema=CleanedDirection)`}
          path="stage3_router/agent.py"
          symbol="quarantine"
          pattern={/quarantine = |def quarantine|mode=|tools=/}
          onSaved={check}
        />
      </In>

      <In delay={0.35}>
        <EditPanel
          label="Edit 2 of 2"
          title="Route the cleaned direction to the scripter."
          intro={<>Only the <code className="font-mono text-fg">Workflow</code> is shown. Add one more tuple: <code className="font-mono text-fg">quarantine</code>, then <code className="font-mono text-fg">scripter</code>. The scripter now has two ways in, and its input has the same three fields either way.</>}
          pill={status ? (rerouteOk ? "quarantine → scripter ✓" : "no edge from quarantine yet") : "…"}
          ok={rerouteOk}
          hint={hintB}
          setHint={setHintB}
          hint1={<>A fifth tuple after the route dict: <code className="font-mono">(quarantine, scripter)</code>.</>}
          hint2={`    edges=[(START, scan_trends, join_research),
           (START, read_backlog, join_research),
           (join_research, propose_directions, direction_gate,
            persist_direction, policy_check),
           (policy_check, {"OK": scripter, "BLOCK": quarantine}),
           (quarantine, scripter)])`}
          path="stage3_router/agent.py"
          symbol="root_agent"
          pattern={/"BLOCK"|\(quarantine, scripter\)/}
          onSaved={check}
        />
      </In>

      <In delay={0.4}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">The graph now</p>
          <RouterFigure reroute />
        </section>
      </In>

      <In delay={0.45}>
        <LoadCheck intro="Save both edits, then click the button. It loads your saved file the way adk web will and tells you either that it loads or what ADK objects to." />
      </In>

      <In delay={0.5}>
        <RunPanel
          app="stage3_router"
          open={open}
          setOpen={setOpen}
          title="Run the blocked route again."
          intro="One run. Answer with 4, the candidate written to be refused. The quarantine agent makes several model calls while it works."
          idea={idea}
          setIdea={setIdea}
          steps={[
            "policy_check shows route: BLOCK, then quarantine's events: a find_policy_hits call and its result, suggest_replacement calls, another find_policy_hits, and finally finish_task carrying the cleaned title, angle and hook.",
            "The scripter runs on the cleaned direction and writes the script. Compare its title with candidate 4's: the scene is the same, the refused words are gone.",
          ]}
        />
      </In>

      <In delay={0.6}>
        <VerifyPanel checking={checking} onCheck={check} intro="Read from this step's app file and its sessions in runs/sessions.db.">
          <CheckRow ok={taskOk} label="quarantine is a task-mode Agent">
            {status ? (status.quarantine_kind ? `a ${status.quarantine_kind}` : "Edit 1 above.") : "…"}
          </CheckRow>
          <CheckRow ok={rerouteOk} label="quarantine continues to the scripter">
            {status ? (rerouteOk ? "(quarantine, scripter) is in the edge list." : "Edit 2 above.") : "…"}
          </CheckRow>
          <CheckRow ok={looped} label="It worked with its tools and finished the task">
            {Object.keys(calls).length ? Object.entries(calls).map(([k, v]) => `${k} ×${v}`).join("  ·  ") : "No quarantine tool calls yet."}
          </CheckRow>
          <CheckRow ok={!!status?.cleaned} label="finish_task carried a cleaned direction">
            {status?.cleaned ? status.cleaned.title : "Not yet."}
          </CheckRow>
          <CheckRow ok={!!status?.cleaned && !!status?.script_title} label="The scripter wrote the script for it">
            {status?.script_title ? `script title: ${status.script_title}` : "Not yet."}
          </CheckRow>
        </VerifyPanel>
      </In>
    </div>
  );
}
