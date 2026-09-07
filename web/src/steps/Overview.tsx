import { Fragment } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { In, StepHeader } from "../components/shared";
import { COLORS } from "./colors";
import { STEPS } from "./registry";

type Kind = "func" | "agent" | "human" | "router" | "desk" | "later" | "join";

interface Node {
  name: string;
  sub: string;
  kind: Kind;
}

/** The pipeline, left to right, as the student will see it run. */
const PIPELINE: Node[][] = [
  [
    { name: "scan_trends", sub: "reader", kind: "func" },
    { name: "read_backcatalog", sub: "reader", kind: "func" },
    { name: "read_graph", sub: "step 8", kind: "later" },
    { name: "read_memory", sub: "step 9", kind: "later" },
  ],
  [{ name: "join_research", sub: "JoinNode", kind: "join" }],
  [{ name: "propose_directions", sub: "Agent · 3 candidates", kind: "agent" }],
  [{ name: "direction_gate", sub: "RequestInput · you pick", kind: "human" }],
  [{ name: "policy_check", sub: "router · OK / BLOCK", kind: "router" }],
  [{ name: "scripter", sub: "Agent · the script", kind: "agent" }],
  [{ name: "render_submit ×3", sub: "LongRunningFunctionTool", kind: "desk" }],
  [{ name: "thumbnail", sub: "you approve", kind: "human" }],
  [{ name: "publish", sub: "eval gate → wall", kind: "func" }],
];

const KIND_STYLE: Record<Kind, { border: string; bg: string; text: string; dashed?: boolean }> = {
  func: { border: "var(--hairline)", bg: "var(--card)", text: "var(--fg)" },
  join: { border: "var(--hairline)", bg: "var(--overlay)", text: "var(--fg)" },
  agent: { border: `${COLORS.purple}66`, bg: `${COLORS.purple}14`, text: COLORS.purple },
  human: { border: `${COLORS.amber}88`, bg: `${COLORS.amber}1a`, text: COLORS.amber },
  router: { border: `${COLORS.red}66`, bg: `${COLORS.red}12`, text: COLORS.red },
  desk: { border: `${COLORS.cyan}66`, bg: `${COLORS.cyan}12`, text: COLORS.cyan },
  later: { border: "var(--hairline)", bg: "transparent", text: "var(--fg-muted)", dashed: true },
};

const YOU = ["Type the video idea (or leave it empty).", "Pick one of three directions, or write your own.", "Approve or regenerate the thumbnail."];
const AUTO = [
  "Four research readers run in parallel and join.",
  "An agent proposes three typed candidates.",
  "A policy function routes OK or BLOCK before any spend.",
  "An agent writes the script.",
  "Three Veo shots and the thumbnail are generated.",
  "The finish worker delivers each result by call id.",
  "An eval gate checks the script, then the video is published.",
];

const LAPS = [
  { n: 1, starts: "Your typed idea", gains: "A published video and audience data" },
  { n: 2, starts: "An idea pre-filled from user:prefs, plus BigQuery readings", gains: "Candidates that cite graph#N" },
  { n: 3, starts: "The above, plus a rule retrieved from Memory Bank", gains: "A script that follows what the audience taught" },
];

export function Overview() {
  const labSteps = STEPS.slice(2);
  return (
    <div className="space-y-12">
      <StepHeader
        kicker="Step 2 · What you build today"
        color={COLORS.purple}
        title="A production pipeline as an explicit graph."
        blurb="One ADK Workflow does the research and the decisions. A plain agent holds the long waits. Your code decides when a run is finished."
      />

      {/* Pipeline strip */}
      <In delay={0.15}>
        <div className="overflow-x-auto rounded-3xl border border-hairline bg-card p-5 shadow-2xl">
          <div className="flex min-w-max items-center gap-2">
            {PIPELINE.map((col, ci) => (
              <Fragment key={ci}>
                {ci > 0 && <span className="px-1 text-fg-muted/40">→</span>}
                <div className="flex flex-col gap-1.5">
                  {col.map((n, ni) => {
                    const s = KIND_STYLE[n.kind];
                    return (
                      <motion.div
                        key={n.name}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 + ci * 0.07 + ni * 0.04 }}
                        className="rounded-xl px-3 py-2"
                        style={{
                          border: `1.5px ${s.dashed ? "dashed" : "solid"} ${s.border}`,
                          background: s.bg,
                          ...(n.kind === "router" ? { clipPath: undefined } : {}),
                        }}
                      >
                        <div className="font-mono text-[12px] font-medium" style={{ color: s.text }}>
                          {n.name}
                        </div>
                        <div className="text-[10px] text-fg-muted">{n.sub}</div>
                      </motion.div>
                    );
                  })}
                </div>
              </Fragment>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] text-fg-muted">
            <Legend kind="agent" label="Agent as a node" />
            <Legend kind="human" label="human decision" />
            <Legend kind="router" label="deterministic router" />
            <Legend kind="desk" label="long-running tool (outside the graph)" />
            <Legend kind="later" label="connected in a later step" />
          </div>
        </div>
      </In>

      {/* You vs automated */}
      <In delay={0.35}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-vibe-amber/40 bg-vibe-amber/5 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-vibe-amber">Your inputs, per video</p>
            <ol className="mt-4 space-y-3">
              {YOU.map((t, i) => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-vibe-amber text-[11px] font-bold text-black">
                    {i + 1}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl border border-hairline bg-card p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Runs without input</p>
            <ul className="mt-4 space-y-2">
              {AUTO.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-fg-muted">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-vibe-cyan" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </In>

      {/* Three laps */}
      <In delay={0.5}>
        <div className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Three videos, one graph</p>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            The edge list changes by two lines across the lab. What changes between videos is the state each run starts with.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {LAPS.map((l) => (
              <div key={l.n} className="rounded-2xl border border-hairline bg-overlay p-4">
                <div className="font-mono text-xs text-vibe-purple">Lap {l.n}</div>
                <div className="mt-2 text-[11px] uppercase tracking-wider text-fg-muted">Starts with</div>
                <div className="text-sm">{l.starts}</div>
                <div className="mt-3 text-[11px] uppercase tracking-wider text-fg-muted">Produces</div>
                <div className="text-sm">{l.gains}</div>
              </div>
            ))}
          </div>
        </div>
      </In>

      {/* Step list */}
      <In delay={0.65}>
        <div className="grid gap-3 md:grid-cols-3">
          {labSteps.map((s, i) => (
            <Link
              key={s.slug}
              to={`/step/${s.slug}`}
              className="group rounded-2xl border border-hairline bg-card p-4 transition-all hover:-translate-y-1 hover:bg-card-hover"
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] font-bold text-black"
                  style={{ background: s.color }}
                >
                  {i + 3}
                </span>
                <span className="text-sm font-semibold group-hover:text-fg">{s.label}</span>
              </div>
              <div className="mt-2 font-mono text-[10px] text-fg-muted">
                {i < 4 ? "Part 1 · Workflow graph design" : "Part 2 · State and persistent memory"}
              </div>
            </Link>
          ))}
        </div>
      </In>
    </div>
  );
}

function Legend({ kind, label }: { kind: Kind; label: string }) {
  const s = KIND_STYLE[kind];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-5 rounded"
        style={{ border: `1.5px ${s.dashed ? "dashed" : "solid"} ${s.border}`, background: s.bg }}
      />
      {label}
    </span>
  );
}
