import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, RefreshCw } from "lucide-react";
import { In, StepHeader } from "../components/shared";
import { CatchUp } from "../components/CatchUp";
import { api, useRunEvents } from "../lib/api";
import type { MemoryBank, Stage4Status } from "../lib/types";
import { COLORS, tint } from "./colors";
import { CheckRow, EditPanel, RunPanel, VerifyPanel } from "./FanOut";

/*
 * Step 6, in parts:
 *   6a  Memory Bank: what it is for, scope, extraction and consolidation, the
 *       two topics; create the bank and seed the creator's history from the console
 *   6b  callbacks: before_model_callback reads the memories into propose_directions'
 *       request, after_agent_callback writes the pick after the scripter; run twice
 */

const PURPLE = COLORS.purple;
const AMBER = COLORS.amber;
const CYAN = COLORS.cyan;
const GREEN = COLORS.green;
const RED = COLORS.red;

type Part = "a" | "b";
const PARTS: { id: Part; label: string }[] = [
  { id: "a", label: "Memory Bank" },
  { id: "b", label: "Callbacks" },
];

export function Memory() {
  const { part: partParam } = useParams();
  const part: Part = PARTS.some((p) => p.id === partParam) ? (partParam as Part) : "a";
  const idx = PARTS.findIndex((p) => p.id === part);
  return (
    <div className="space-y-12">
      {part === "a" && <TheBank />}
      {part === "b" && <TheCallbacks />}
      <div className="flex items-center justify-between border-t border-hairline pt-6">
        {idx > 0 ? (
          <Link to={`/step/memory/${PARTS[idx - 1].id}`} className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-fg-muted hover:text-fg">
            ← 6{PARTS[idx - 1].id} · {PARTS[idx - 1].label}
          </Link>
        ) : (
          <span />
        )}
        {idx < PARTS.length - 1 && (
          <Link to={`/step/memory/${PARTS[idx + 1].id}`} className="flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-black" style={{ background: PURPLE }}>
            Continue to 6{PARTS[idx + 1].id} · {PARTS[idx + 1].label} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

/** The graph as built through step 6. The two agents that carry the memory
 *  callbacks are highlighted; every other node is unchanged from step 5. */
function WorkflowFigure() {
  const node = (cx: number, cy: number, label: string, kind: "func" | "join" | "agent" | "human" | "router" | "task", tag?: string) => {
    const color = kind === "agent" ? PURPLE : kind === "join" ? CYAN : kind === "human" ? AMBER : kind === "router" ? RED : kind === "task" ? PURPLE : "currentColor";
    const lit = kind === "agent";
    return (
      <g key={label}>
        {lit && <rect x={cx - 62} y={cy - 19} width="124" height="38" rx="11" fill="none" stroke={PURPLE} strokeOpacity="0.35" strokeWidth="6" />}
        <rect x={cx - 56} y={cy - 13} width="112" height="26" rx="8" fill={lit ? tint(PURPLE, 0.15) : kind === "func" ? "var(--overlay)" : tint(color, 0.08)} stroke={lit ? PURPLE : kind === "func" ? "var(--hairline)" : color} strokeWidth={lit ? 1.6 : 1.1} />
        <text x={cx} y={cy + 4} fontSize="9.5" fontFamily="var(--font-mono)" textAnchor="middle" fill={lit ? PURPLE : kind === "func" ? "currentColor" : color}>{label}</text>
        {tag && <text x={cx} y={cy + 30} fontSize="8.5" fontFamily="var(--font-mono)" textAnchor="middle" fill={PURPLE}>{tag}</text>}
      </g>
    );
  };
  const edge = (x1: number, y1: number, x2: number, y2: number, color = "currentColor", dashed = false) => <line key={`${x1}${y1}${x2}${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeOpacity={color === "currentColor" ? 0.55 : 0.9} strokeWidth="1.2" strokeDasharray={dashed ? "4 3" : undefined} markerEnd="url(#wf-arrow)" />;
  return (
    <figure className="m-0 mt-4">
      <svg viewBox="0 0 1016 250" className="h-auto w-full text-fg" role="img" aria-label="The workflow through step 6: START fans out to scan_trends and read_backlog, join_research, propose_directions with before_model_callback recall_taste, direction_gate, persist_direction, policy_check routing OK to scripter with after_agent_callback remember_pick and BLOCK to quarantine, which continues to scripter.">
        <defs>
          <marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <circle cx="30" cy="100" r="12" fill="var(--overlay)" stroke="currentColor" strokeOpacity="0.6" />
        <text x="30" y="104" fontSize="8.5" fontFamily="var(--font-mono)" textAnchor="middle" fill="currentColor">START</text>
        {node(120, 60, "scan_trends", "func")}
        {node(120, 140, "read_backlog", "func")}
        {node(245, 100, "join_research", "join")}
        {node(375, 100, "propose_directions", "agent", "before_model_callback: recall_taste")}
        {node(505, 100, "direction_gate", "human")}
        {node(635, 100, "persist_direction", "func")}
        {node(765, 100, "policy_check", "router")}
        {node(910, 55, "scripter", "agent", "after_agent_callback: remember_pick")}
        {node(910, 175, "quarantine", "task")}
        {edge(42, 95, 62, 65)}
        {edge(42, 105, 62, 135)}
        {edge(176, 60, 187, 95)}
        {edge(176, 140, 187, 105)}
        {edge(301, 100, 317, 100)}
        {edge(431, 100, 447, 100)}
        {edge(561, 100, 577, 100)}
        {edge(691, 100, 707, 100)}
        {edge(821, 92, 852, 60, GREEN)}
        <text x="836" y="70" fontSize="8.5" fontFamily="var(--font-mono)" fill={GREEN}>OK</text>
        {edge(821, 108, 852, 170, RED)}
        <text x="828" y="150" fontSize="8.5" fontFamily="var(--font-mono)" fill={RED}>BLOCK</text>
        <path d="M966 175 C 995 175, 995 55, 968 55" fill="none" stroke={PURPLE} strokeOpacity="0.8" strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#wf-arrow)" />
        <text x="996" y="118" fontSize="8" fontFamily="var(--font-mono)" fill={PURPLE} textAnchor="middle" transform="rotate(90 996 118)">cleaned</text>
        <text x="375" y="230" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle" fill="currentColor" opacity="0.6">reads the bank before its model call</text>
        <text x="880" y="230" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle" fill="currentColor" opacity="0.6">writes the pick after its turn</text>
      </svg>
      <figcaption className="mt-2 text-xs text-fg-muted">The highlighted agents are the only change from step 5: a callback on each. The edge list is untouched.</figcaption>
    </figure>
  );
}

/** A file from the repo, shown on request. */
function SourceToggle({ path, label }: { path: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const toggle = async () => {
    if (!open && code === null) {
      try {
        setCode((await api.getCode(path)).content);
      } catch {
        setCode(`could not read ${path}`);
      }
    }
    setOpen((o) => !o);
  };
  return (
    <div className="mt-4 min-w-0 flex-1 basis-[320px]">
      <button onClick={toggle} className="rounded-xl border border-hairline bg-overlay px-4 py-2 text-left font-mono text-xs text-fg-muted hover:text-fg">
        {open ? "Hide the code" : "Show the code"} · {label}
      </button>
      {open && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-hairline bg-input">
          <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">{label}</div>
          <pre className="max-h-[520px] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
            <code>{code ?? "…"}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

/** The bank's contents, fetched on demand: one network call per click. */
function BankLedger({ title, refreshKey = 0 }: { title: string; refreshKey?: number }) {
  const [bank, setBank] = useState<MemoryBank | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBank(await api.labMemory());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (refreshKey > 0) load();
  }, [refreshKey, load]);
  return (
    <section className="rounded-3xl border border-hairline bg-card p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">The bank</p>
          <h2 className="font-display mt-2 text-2xl">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">Reads the bank in your project, oldest memory first. The same call the callback makes before propose_directions runs.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-xl border border-hairline bg-overlay px-4 py-2 font-mono text-xs text-fg-muted hover:text-fg">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Show the bank
        </button>
      </div>
      {bank && (
        <div className="mt-4 rounded-2xl border border-hairline bg-overlay p-4">
          {!bank.connected ? (
            <p className="text-sm text-fg-muted">No bank yet. Run the first command above.</p>
          ) : bank.error ? (
            <p className="font-mono text-xs" style={{ color: RED }}>{bank.error}</p>
          ) : (
            <>
              <p className="font-mono text-[11px] text-fg-muted">
                {bank.memories.length} memor{bank.memories.length === 1 ? "y" : "ies"} · {bank.engine?.split("/").slice(-1)[0]}
              </p>
              <ul className="mt-3 space-y-2">
                {bank.memories.map((m) => (
                  <li key={m.id} className="text-sm">
                    <span className="rounded px-1.5 py-0.5 font-mono text-[10px]" style={{ background: tint(PURPLE, 0.13), color: PURPLE }}>
                      {m.topic}
                    </span>
                    <span className="ml-2">{m.fact}</span>
                  </li>
                ))}
                {bank.memories.length === 0 && <li className="text-sm text-fg-muted">Empty. Run the load command.</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

type BankCmd = "connect" | "load" | "list" | "reset";
const BANK_COMMANDS: { cmd: BankCmd; line: string; what: string }[] = [
  { cmd: "connect", line: "python -m agent.platform.bank", what: "Creates the Agent Engine that hosts the bank, once, and prints the scope and the topics. Runs again as connect." },
  { cmd: "load", line: "python -m agent.platform.bank load", what: "Seeds four past sessions, oldest first: two picks of animals with one stated rule, one of gadgets, one of fantasy. Under a minute." },
  { cmd: "list", line: "python -m agent.platform.bank list", what: "Everything the bank holds for the creator, oldest first. Compare it with the four sessions." },
];

/** The bank commands, run here as the same `python -m agent.platform.bank` process a
 *  terminal would start. Output streams in as it is printed. */
function BankRunner({ onDone }: { onDone: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState<BankCmd | null>(null);
  const [exit, setExit] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<BankCmd | null>(null);
  useRunEvents((verb, line) => {
    if (verb === "bank") setLines((l) => [...l.slice(-199), line]);
  });
  useEffect(() => {
    // a bank command may already be running on the server (started from another
    // tab or a terminal): show it as running so the buttons explain themselves
    api.bankStatus().then((st) => {
      if (st.running) {
        setRunning(true);
        setLines(["a bank command is already running on this server; its remaining output appears here"]);
      }
    });
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      const st = await api.bankStatus();
      if (!st.running) {
        setRunning(false);
        setExit(st.last_exit?.code ?? null);
        onDone();
      }
    }, 1500);
    return () => clearInterval(t);
  }, [running, onDone]);
  const run = async (cmd: BankCmd) => {
    setLines([]);
    setExit(null);
    const r = (await api.bankRun(cmd)) as { ok: boolean; detail: string };
    if (!r.ok) {
      setLines([`could not start: ${r.detail}. Wait for it to finish; the buttons enable again when it exits.`]);
      setRunning(true);
      return;
    }
    setRunning(true);
    if (cmd !== "list") setOverlay(cmd);
  };
  return (
    <>
      <AnimatePresence>
        {overlay && <BankOverlay cmd={overlay} lines={lines} running={running} exit={exit} onClose={() => setOverlay(null)} />}
      </AnimatePresence>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {BANK_COMMANDS.map((c) => (
          <li key={c.cmd} className="rounded-2xl border border-hairline bg-overlay p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(c.line);
                  setCopied(c.cmd);
                  setTimeout(() => setCopied(null), 1200);
                }}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border border-hairline bg-input px-3 py-2 text-left font-mono text-xs text-fg hover:border-vibe-cyan/60"
                title="copy for a terminal"
              >
                <span className="truncate">{c.line}</span>
                <span className="shrink-0 text-[10px] text-fg-muted">{copied === c.cmd ? "copied" : "copy"}</span>
              </button>
              <button
                onClick={() => run(c.cmd)}
                disabled={running}
                className="shrink-0 rounded-lg px-3 py-2 font-mono text-xs font-bold text-black disabled:opacity-40"
                style={{ background: PURPLE }}
              >
                run
              </button>
            </div>
            <p className="mt-2 text-xs text-fg-muted">{c.what}</p>
          </li>
        ))}
      </ol>
      {(lines.length > 0 || running) && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-hairline bg-input">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
            <span>python -m agent.platform.bank · output</span>
            <span>{running ? "running…" : exit === 0 ? "done" : exit === null ? "" : `exit ${exit}`}</span>
          </div>
          <pre className="max-h-72 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
            {lines.filter((l) => !/Warning|warn\(/.test(l)).join("\n") || (running ? "starting…" : "")}
          </pre>
        </div>
      )}
    </>
  );
}

/** A full-screen modal for the two long bank commands: the page stays put,
 *  the output streams in, and the animation shows what the command is doing
 *  on Google Cloud. Closes only once the process has exited. */
function BankOverlay({ cmd, lines, running, exit, onClose }: { cmd: BankCmd; lines: string[]; running: boolean; exit: number | null; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const clean = lines.filter((l) => !/Warning|warn\(/.test(l));
  const done = !running && exit !== null;
  const failed = done && exit !== 0;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }} role="dialog" aria-modal="true" aria-label={cmd === "connect" ? "Creating the Memory Bank" : "Loading the creator's history"}>
      <motion.div initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, scale: 0.98 }} className="w-full max-w-3xl overflow-hidden rounded-3xl border border-hairline bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <div className="flex items-center gap-3">
            {!done && <RefreshCw size={14} className="animate-spin" style={{ color: PURPLE }} />}
            <span className="font-mono text-xs text-fg">{cmd === "connect" ? "python -m agent.platform.bank" : "python -m agent.platform.bank load"}</span>
          </div>
          <span className="font-mono text-[11px]" style={{ color: failed ? RED : done ? GREEN : "var(--fg-muted)" }}>
            {done ? (failed ? `exited with ${exit}` : "done") : "running on this server…"}
          </span>
        </div>
        <div className="p-5">
          {cmd === "connect" ? <ConnectAnimation lines={clean} done={done} /> : <LoadAnimation lines={clean} done={done} />}
        </div>
        <div className="border-t border-hairline bg-input">
          <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">output</div>
          <pre className="max-h-40 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">{clean.slice(-30).join("\n") || "starting…"}</pre>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-hairline px-5 py-3">
          {!done && <span className="text-xs text-fg-muted">The page is locked until the command finishes.</span>}
          <button onClick={onClose} disabled={!done} className="rounded-xl px-4 py-2 font-mono text-xs font-bold text-black disabled:opacity-40" style={{ background: PURPLE }}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** `python -m agent.platform.bank`: an Agent Engine resource appears in the project,
 *  then the two memory topics are attached to it. The motion repeats while
 *  the command runs; the final state holds once it has finished. */
function ConnectAnimation({ lines, done }: { lines: string[]; done: boolean }) {
  const text = lines.join("\n");
  const created = /created|connected/.test(text);
  const topics = /topics:/.test(text);
  const loop = done ? { repeat: 0 } : { repeat: Infinity, repeatDelay: 1.2 };
  const stage = (label: string, ok: boolean, x: number, delay: number, color: string) => (
    <motion.g key={label} initial={{ opacity: 0.2, y: 8 }} animate={done ? { opacity: 1, y: 0 } : { opacity: [0.2, 1, 1, 0.2], y: [8, 0, 0, 8] }} transition={{ duration: 3.6, delay, ...loop }}>
      <rect x={x - 70} y={104} width={140} height={44} rx={12} fill={tint(color, 0.12)} stroke={ok ? color : "var(--hairline)"} strokeWidth={1.4} />
      <text x={x} y={124} textAnchor="middle" fontSize={11} fontFamily="var(--font-mono)" fill={ok ? color : "currentColor"}>{label}</text>
      <text x={x} y={140} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill="currentColor" opacity={0.6}>{ok ? "created" : "creating…"}</text>
    </motion.g>
  );
  return (
    <div>
      <p className="text-sm text-fg-muted">
        Creating an Agent Engine in your project to host the bank, then attaching the two memory topics. The first run takes about half a
        minute; every later run reconnects to the cached resource.
      </p>
      <svg viewBox="0 0 620 180" className="mt-3 h-auto w-full text-fg" role="img" aria-label="An Agent Engine is created in the project, then the CREATOR_TASTE and CHANNEL_RULES topics are attached to its Memory Bank.">
        <rect x="10" y="14" width="600" height="156" rx="16" fill="var(--overlay)" stroke="var(--hairline)" />
        <text x="26" y="36" fontSize="10" fontFamily="var(--font-mono)" fill="currentColor" opacity="0.6">GOOGLE CLOUD · your project · us-central1</text>
        <motion.g initial={{ opacity: 0.2, scale: 0.9 }} animate={done ? { opacity: 1, scale: 1 } : { opacity: [0.2, 1, 1, 0.2], scale: [0.9, 1, 1, 0.9] }} transition={{ duration: 3.6, ...loop }} style={{ transformOrigin: "120px 92px" }}>
          <rect x="40" y="52" width="160" height="80" rx="14" fill={tint(PURPLE, 0.12)} stroke={created ? PURPLE : "var(--hairline)"} strokeWidth={1.6} />
          <text x="120" y="82" textAnchor="middle" fontSize="12" fontFamily="var(--font-mono)" fill={PURPLE}>Agent Engine</text>
          <text x="120" y="100" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="currentColor" opacity="0.7">Memory Bank</text>
          <text x="120" y="118" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="currentColor" opacity="0.55">{created ? "vibestudio-membank" : "creating…"}</text>
        </motion.g>
        <motion.path d="M200 92 L 260 92" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="4 3" initial={{ pathLength: 0 }} animate={done ? { pathLength: 1 } : { pathLength: [0, 1, 1, 0] }} transition={{ duration: 3.6, delay: 0.6, ...loop }} />
        {stage("CREATOR_TASTE", topics, 340, 1.0, AMBER)}
        {stage("CHANNEL_RULES", topics, 520, 1.6, CYAN)}
        <text x="430" y="72" textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="currentColor" opacity="0.6">memory topics · what a memory may be about</text>
      </svg>
    </div>
  );
}

/** `python -m agent.platform.bank load`: twelve sessions leave the history column and
 *  land as memories under the two topics. Progress follows the output. */
function LoadAnimation({ lines, done }: { lines: string[]; done: boolean }) {
  const sessions = lines.map((l) => l.match(/session\s+(\d+):\s+(.*)/)).filter(Boolean) as RegExpMatchArray[];
  const n = sessions.length;
  const total = 4;
  const actions = sessions.map((m) => m[2]);
  const created = actions.filter((a) => /CREATED/.test(a)).length;
  const updated = actions.filter((a) => /UPDATED/.test(a)).length;
  const failed = actions.filter((a) => /FAILED/.test(a)).length;
  const eras = [
    { name: "animals", from: 1, to: 2, color: GREEN },
    { name: "gadgets", from: 3, to: 3, color: AMBER },
    { name: "fantasy", from: 4, to: 4, color: PURPLE },
  ];
  const loop = done ? { repeat: 0 } : { repeat: Infinity };
  const stages = ["extract", "embed", "consolidate"];
  return (
    <div>
      <p className="text-sm text-fg-muted">
        Each past session is one <code className="font-mono text-fg">memories.generate</code> call. Memory Bank extracts the facts with a
        Gemini model, embeds them so it can find the memories they resemble, and consolidates: a session either creates a memory or
        updates one under the two topics.
      </p>
      <svg viewBox="0 0 620 210" className="mt-3 h-auto w-full text-fg" role="img" aria-label="Twelve past sessions in three eras flow into the CREATOR_TASTE and CHANNEL_RULES topics of the Memory Bank as memories are created or updated.">
        <text x="14" y="22" fontSize="10" fontFamily="var(--font-mono)" fill="currentColor" opacity="0.6">4 past sessions · oldest first</text>
        {eras.map((e, i) => (
          <g key={e.name}>
            <rect x="14" y={34 + i * 56} width="150" height="44" rx="10" fill={tint(e.color, 0.08)} stroke={e.color} strokeOpacity="0.6" />
            <text x="26" y={52 + i * 56} fontSize="11" fontFamily="var(--font-mono)" fill={e.color}>{e.name}</text>
            <text x="26" y={68 + i * 56} fontSize="9.5" fontFamily="var(--font-mono)" fill="currentColor" opacity="0.7">
              {e.from === e.to ? `session ${e.from}` : `sessions ${e.from}–${e.to}`} · {Math.min(Math.max(n - e.from + 1, 0), e.to - e.from + 1)}/{e.to - e.from + 1} loaded
            </text>
            {!done && n >= e.from - 1 && n < e.to && (
              <motion.circle r="5" fill={e.color} initial={{ cx: 164, cy: 56 + i * 56, opacity: 0 }} animate={{ cx: [164, 292, 440], cy: [56 + i * 56, 88, 84], opacity: [0, 1, 0] }} transition={{ duration: 1.6, ease: "easeInOut", ...loop }} />
            )}
          </g>
        ))}
        <path d="M164 56 C 240 56, 240 88, 292 88 M164 112 C 240 112, 240 88, 292 88 M164 168 C 240 168, 240 88, 292 88" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" />
        <rect x="292" y="36" width="136" height="104" rx="12" fill={tint(PURPLE, 0.12)} stroke={PURPLE} strokeWidth="1.4" />
        <text x="360" y="54" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={PURPLE}>memories.generate</text>
        {stages.map((st, i) => (
          <g key={st}>
            <motion.rect x="304" y={62 + i * 22} width="112" height="18" rx="5" fill={PURPLE} initial={{ fillOpacity: 0.08 }} animate={done ? { fillOpacity: 0.16 } : { fillOpacity: [0.08, 0.38, 0.08] }} transition={{ duration: 2.4, delay: i * 0.8, ...loop }} />
            <text x="314" y={75 + i * 22} fontSize="9.5" fontFamily="var(--font-mono)" fill="currentColor">{i + 1}. {st}</text>
            {st === "embed" && (
              <g>
                {[0, 1, 2, 3, 4].map((k) => (
                  <motion.rect key={k} x={384 + k * 6} width="4" rx="1" fill={PURPLE} initial={{ y: 72, height: 4 }} animate={done ? { y: 68, height: 8 } : { y: [72, 65 + (k % 3) * 2, 72], height: [4, 12 - (k % 3) * 2, 4] }} transition={{ duration: 1.2, delay: 0.8 + k * 0.12, ...loop }} />
                ))}
              </g>
            )}
          </g>
        ))}
        <text x="360" y="134" textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="currentColor" opacity="0.7">{n}/{total} sessions</text>
        <path d="M428 70 L 456 60 M428 100 L 456 122" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.2" />
        <g>
          <rect x="458" y="34" width="150" height="52" rx="10" fill={tint(AMBER, 0.08)} stroke={AMBER} strokeOpacity="0.8" />
          <text x="470" y="54" fontSize="11" fontFamily="var(--font-mono)" fill={AMBER}>CREATOR_TASTE</text>
          <text x="470" y="72" fontSize="9.5" fontFamily="var(--font-mono)" fill="currentColor" opacity="0.7">{created} created · {updated} updated</text>
          <rect x="458" y="98" width="150" height="52" rx="10" fill={tint(CYAN, 0.08)} stroke={CYAN} strokeOpacity="0.8" />
          <text x="470" y="118" fontSize="11" fontFamily="var(--font-mono)" fill={CYAN}>CHANNEL_RULES</text>
          <text x="470" y="136" fontSize="9.5" fontFamily="var(--font-mono)" fill="currentColor" opacity="0.7">from the stated rule</text>
        </g>
        <rect x="14" y="192" width="594" height="8" rx="4" fill="var(--overlay)" stroke="var(--hairline)" />
        <motion.rect x="14" y="192" height="8" rx="4" fill={PURPLE} initial={{ width: 0 }} animate={{ width: (594 * n) / total }} transition={{ duration: 0.6 }} />
        {failed > 0 && (
          <text x="608" y="186" textAnchor="end" fontSize="9.5" fontFamily="var(--font-mono)" fill={RED}>{failed} session{failed === 1 ? "" : "s"} failed · run load again later</text>
        )}
      </svg>
    </div>
  );
}

/* ───────────────────────── 6a ───────────────────────── */


const CODE_TOPICS = `# agent/platform/memory.py
SCOPE = {"app_name": config.APP, "user_id": config.USER}
TOPICS = {
    "CREATOR_TASTE": "Which video directions this creator picks and passes on, "
                     "and how that preference changes over time.",
    "CHANNEL_RULES": "Standing instructions the creator states for every video "
                     "(style, subjects to avoid, format rules).",
}`;


const CODE_REMEMBER = `# agent/platform/memory.py
def remember(text: str) -> list[dict]:
    """Hand one exchange to Memory Bank. It extracts the facts worth keeping,
    consolidates them with the memories it already has, and returns what it
    did: CREATED, UPDATED, or nothing new."""
    name = engine_name()
    if not name:
        raise RuntimeError("no Memory Bank connected - run: python -m agent.platform.bank")
    op = _cli().agent_engines.memories.generate(
        name=name, scope=SCOPE,
        direct_contents_source={"events": [{"content": {"role": "user", "parts": [{"text": text}]}}]},
        config={"wait_for_completion": True})
    flags = []
    resp = getattr(op, "response", None)
    for g in (getattr(resp, "generated_memories", None) or []):
        mem = getattr(g, "memory", None)
        flags.append({"action": str(getattr(g, "action", "")).split(".")[-1],
                      "id": (getattr(mem, "name", "") or "").split("/")[-1],
                      "fact": (getattr(mem, "fact", "") or "")[:160]})
    return flags`;

/** Memory Bank in one picture: what goes in (the run's exchanges, through one
 *  generate call), what the service does with it (extract, embed, consolidate
 *  under a scope and two topics, on GEAP), what comes out (facts, by scope),
 *  and what does not belong here. */
function BankFigure() {
  const box = { fill: "var(--overlay)", stroke: "var(--hairline)" };
  const mono = { fontFamily: "var(--font-mono)" } as const;
  return (
    <figure className="m-0 min-w-[840px]">
      <svg viewBox="0 0 940 318" role="img" aria-label="The scripter's callback hands one exchange to Memory Bank with memories.generate. Memory Bank, an Agent Engine resource on GEAP, keeps facts under a scope of app_name and user_id and two topics, CREATOR_TASTE and CHANNEL_RULES. Inside, a Gemini model extracts facts, the facts are embedded, and similar facts are consolidated into one memory. propose_directions' callback reads them back with memories.retrieve by scope. Documents go to RAG Engine; a person's preferences go here." className="h-auto w-full text-fg">
        <defs>
          <marker id="mb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
          <marker id="mb-arrow-p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={PURPLE} />
          </marker>
        </defs>

        {/* write side */}
        <rect x="14" y="70" width="150" height="58" rx="8" {...box} />
        <text x="89" y="88" fontSize="9.5" style={mono} textAnchor="middle" fill="currentColor">scripter · after the run</text>
        <text x="89" y="103" fontSize="8" style={mono} textAnchor="middle" fill="currentColor" opacity="0.65">"the creator picked X (angle)…"</text>
        <text x="89" y="117" fontSize="8" style={mono} textAnchor="middle" fill="currentColor" opacity="0.65">one exchange, as events</text>
        <line x1="164" y1="99" x2="248" y2="99" stroke={PURPLE} strokeWidth="1.3" markerEnd="url(#mb-arrow-p)" />
        <text x="206" y="91" fontSize="8" style={mono} textAnchor="middle" fill={PURPLE}>memories.generate</text>
        <text x="206" y="112" fontSize="7.5" style={mono} textAnchor="middle" fill="currentColor" opacity="0.6">the write</text>

        {/* the bank */}
        <rect x="250" y="18" width="440" height="230" rx="14" fill={tint(PURPLE, 0.05)} stroke={PURPLE} strokeWidth="1.3" />
        <text x="266" y="38" fontSize="11" style={mono} fill={PURPLE}>Memory Bank</text>
        <text x="674" y="38" fontSize="8.5" style={mono} textAnchor="end" fill="currentColor" opacity="0.6">an Agent Engine resource on GEAP</text>
        <rect x="266" y="50" width="196" height="40" rx="8" {...box} />
        <text x="276" y="65" fontSize="8.5" style={mono} fill="currentColor" opacity="0.65">scope · whose memories</text>
        <text x="276" y="81" fontSize="9" style={mono} fill="currentColor">{'{app_name, user_id}'}: the creator</text>
        <rect x="478" y="50" width="196" height="40" rx="8" {...box} />
        <text x="488" y="65" fontSize="8.5" style={mono} fill="currentColor" opacity="0.65">topics · what a memory may be about</text>
        <text x="488" y="81" fontSize="9" style={mono} fill="currentColor">CREATOR_TASTE · CHANNEL_RULES</text>
        {/* pipeline */}
        <rect x="266" y="112" width="120" height="40" rx="8" fill={tint(PURPLE, 0.1)} stroke={PURPLE} strokeOpacity="0.7" />
        <text x="326" y="128" fontSize="9.5" style={mono} textAnchor="middle" fill={PURPLE}>extract</text>
        <text x="326" y="142" fontSize="7.5" style={mono} textAnchor="middle" fill="currentColor" opacity="0.65">a Gemini model, per topic</text>
        <line x1="386" y1="132" x2="408" y2="132" stroke="currentColor" strokeWidth="1.1" markerEnd="url(#mb-arrow)" />
        <rect x="410" y="112" width="120" height="40" rx="8" fill={tint(PURPLE, 0.1)} stroke={PURPLE} strokeOpacity="0.7" />
        <text x="470" y="128" fontSize="9.5" style={mono} textAnchor="middle" fill={PURPLE}>embed</text>
        <text x="470" y="142" fontSize="7.5" style={mono} textAnchor="middle" fill="currentColor" opacity="0.65">to find what it resembles</text>
        <line x1="530" y1="132" x2="552" y2="132" stroke="currentColor" strokeWidth="1.1" markerEnd="url(#mb-arrow)" />
        <rect x="554" y="112" width="120" height="40" rx="8" fill={tint(PURPLE, 0.1)} stroke={PURPLE} strokeOpacity="0.7" />
        <text x="614" y="128" fontSize="9.5" style={mono} textAnchor="middle" fill={PURPLE}>consolidate</text>
        <text x="614" y="142" fontSize="7.5" style={mono} textAnchor="middle" fill="currentColor" opacity="0.65">merge with a match</text>
        {/* the memories */}
        <line x1="614" y1="152" x2="614" y2="170" stroke="currentColor" strokeWidth="1.1" markerEnd="url(#mb-arrow)" />
        <rect x="266" y="172" width="408" height="62" rx="8" {...box} />
        <text x="276" y="187" fontSize="8.5" style={mono} fill="currentColor" opacity="0.65">memories · one fact each, under the scope, tagged with a topic</text>
        <text x="276" y="204" fontSize="8.5" style={mono} fill={PURPLE}>CREATOR_TASTE</text>
        <text x="380" y="204" fontSize="8.5" style={mono} fill="currentColor">picks small-magic scenes; was gadgets, then animals</text>
        <text x="276" y="221" fontSize="8.5" style={mono} fill={PURPLE}>CHANNEL_RULES</text>
        <text x="380" y="221" fontSize="8.5" style={mono} fill="currentColor">no text on screen; nothing that mocks a competitor</text>

        {/* read side */}
        <line x1="690" y1="99" x2="774" y2="99" stroke={PURPLE} strokeWidth="1.3" markerEnd="url(#mb-arrow-p)" />
        <text x="732" y="91" fontSize="8" style={mono} textAnchor="middle" fill={PURPLE}>memories.retrieve</text>
        <text x="732" y="112" fontSize="7.5" style={mono} textAnchor="middle" fill="currentColor" opacity="0.6">the read, by scope</text>
        <rect x="776" y="70" width="150" height="58" rx="8" {...box} />
        <text x="851" y="88" fontSize="9.5" style={mono} textAnchor="middle" fill="currentColor">propose_directions</text>
        <text x="851" y="103" fontSize="8" style={mono} textAnchor="middle" fill="currentColor" opacity="0.65">reads every memory in the scope</text>
        <text x="851" y="117" fontSize="8" style={mono} textAnchor="middle" fill="currentColor" opacity="0.65">before its model call</text>

        {/* the contrast */}
        <line x1="14" y1="270" x2="926" y2="270" stroke="var(--hairline)" />
        <text x="14" y="290" fontSize="8.5" style={mono} fill="currentColor" opacity="0.65">what goes where</text>
        <text x="140" y="290" fontSize="8.5" style={mono} fill="currentColor">documents, transcripts → RAG Engine (step 7)</text>
        <text x="420" y="290" fontSize="8.5" style={mono} fill={PURPLE}>a person's preferences → Memory Bank (this step)</text>
        <text x="14" y="306" fontSize="8" style={mono} fill="currentColor" opacity="0.55">not a document store, not analytics: facts about one user</text>
      </svg>
    </figure>
  );
}

/** One generate call, under the hood: the exchange goes in, the two topic
 *  definitions steer extraction, each fact is embedded and compared with the
 *  scope's existing memories, and the response says what happened to each. */
function GenerateFigure() {
  const box = { fill: "var(--overlay)", stroke: "var(--hairline)" };
  const mono = { fontFamily: "var(--font-mono)" } as const;
  return (
    <figure className="m-0 min-w-[840px]">
      <svg viewBox="0 0 940 292" role="img" aria-label="One memories.generate call. The exchange text goes in with the scope. A Gemini model extracts facts, one per topic that applies: a CREATOR_TASTE fact and, when the text states a rule, a CHANNEL_RULES fact; anything outside the two topics is dropped. Each fact is embedded and compared with the memories already in the scope: a close match updates that memory, no match creates a new one. The response lists each generated memory with its action, CREATED or UPDATED." className="h-auto w-full text-fg">
        <defs>
          <marker id="gn-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
          <marker id="gn-arrow-p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={PURPLE} />
          </marker>
        </defs>
        {/* the call */}
        <rect x="14" y="60" width="188" height="90" rx="8" {...box} />
        <text x="24" y="76" fontSize="8.5" style={mono} fill={PURPLE}>memories.generate(</text>
        <text x="34" y="90" fontSize="8.5" style={mono} fill="currentColor">scope={'{app_name, user_id}'},</text>
        <text x="34" y="104" fontSize="8.5" style={mono} fill="currentColor">events=[ "Tonight the creator</text>
        <text x="34" y="118" fontSize="8.5" style={mono} fill="currentColor">  picked 'Tiny dragon…' (angle).</text>
        <text x="34" y="132" fontSize="8.5" style={mono} fill="currentColor">  A script was written." ])</text>
        <text x="108" y="166" fontSize="7.5" style={mono} textAnchor="middle" fill="currentColor" opacity="0.6">remember(text), from the scripter's callback</text>
        <line x1="202" y1="105" x2="238" y2="105" stroke={PURPLE} strokeWidth="1.2" markerEnd="url(#gn-arrow-p)" />

        {/* extract with topics */}
        <rect x="240" y="40" width="200" height="130" rx="10" fill={tint(PURPLE, 0.08)} stroke={PURPLE} strokeOpacity="0.8" />
        <text x="340" y="58" fontSize="9.5" style={mono} textAnchor="middle" fill={PURPLE}>extract · a Gemini model</text>
        <text x="340" y="72" fontSize="7.5" style={mono} textAnchor="middle" fill="currentColor" opacity="0.65">reads the text once per topic</text>
        <rect x="252" y="82" width="176" height="34" rx="6" {...box} />
        <text x="262" y="96" fontSize="8.5" style={mono} fill={PURPLE}>CREATOR_TASTE</text>
        <text x="262" y="109" fontSize="7.5" style={mono} fill="currentColor" opacity="0.7">what they pick, how it moves</text>
        <rect x="252" y="122" width="176" height="34" rx="6" {...box} />
        <text x="262" y="136" fontSize="8.5" style={mono} fill={PURPLE}>CHANNEL_RULES</text>
        <text x="262" y="149" fontSize="7.5" style={mono} fill="currentColor" opacity="0.7">standing instructions</text>

        {/* facts out */}
        <line x1="428" y1="99" x2="470" y2="86" stroke="currentColor" strokeWidth="1.1" markerEnd="url(#gn-arrow)" />
        <line x1="428" y1="139" x2="470" y2="150" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.1" strokeDasharray="4 3" markerEnd="url(#gn-arrow)" />
        <rect x="472" y="66" width="200" height="40" rx="8" {...box} />
        <text x="482" y="81" fontSize="8.5" style={mono} fill="currentColor">fact: picks small-magic scenes</text>
        <text x="482" y="96" fontSize="7.5" style={mono} fill="currentColor" opacity="0.65">tagged CREATOR_TASTE</text>
        <rect x="472" y="134" width="200" height="34" rx="8" fill="none" stroke="var(--hairline)" strokeDasharray="4 3" />
        <text x="482" y="149" fontSize="8.5" style={mono} fill="currentColor" opacity="0.6">no rule stated tonight</text>
        <text x="482" y="161" fontSize="7.5" style={mono} fill="currentColor" opacity="0.5">nothing for CHANNEL_RULES</text>
        <text x="572" y="196" fontSize="8" style={mono} textAnchor="middle" fill="currentColor" opacity="0.6">"a script was written": outside both topics, dropped</text>

        {/* embed + compare */}
        <line x1="672" y1="86" x2="712" y2="86" stroke="currentColor" strokeWidth="1.1" markerEnd="url(#gn-arrow)" />
        <rect x="714" y="40" width="212" height="130" rx="10" fill={tint(PURPLE, 0.08)} stroke={PURPLE} strokeOpacity="0.8" />
        <text x="820" y="58" fontSize="9.5" style={mono} textAnchor="middle" fill={PURPLE}>embed, then compare</text>
        <text x="820" y="72" fontSize="7.5" style={mono} textAnchor="middle" fill="currentColor" opacity="0.65">with the memories already in the scope</text>
        <rect x="726" y="82" width="188" height="34" rx="6" {...box} />
        <text x="736" y="96" fontSize="8.5" style={mono} fill="currentColor">close match → UPDATED</text>
        <text x="736" y="109" fontSize="7.5" style={mono} fill="currentColor" opacity="0.7">"was gadgets" becomes "now small magic"</text>
        <rect x="726" y="122" width="188" height="34" rx="6" {...box} />
        <text x="736" y="136" fontSize="8.5" style={mono} fill="currentColor">no match → CREATED</text>
        <text x="736" y="149" fontSize="7.5" style={mono} fill="currentColor" opacity="0.7">a new memory under the scope</text>

        {/* response */}
        <line x1="820" y1="170" x2="820" y2="212" stroke={PURPLE} strokeWidth="1.2" markerEnd="url(#gn-arrow-p)" />
        <rect x="540" y="214" width="386" height="60" rx="8" {...box} />
        <text x="550" y="230" fontSize="8.5" style={mono} fill={PURPLE}>response.generated_memories</text>
        <text x="550" y="246" fontSize="8.5" style={mono} fill="currentColor">[ {'{action: UPDATED, memory: {fact: "…small magic…", topic: …}}'} ]</text>
        <text x="550" y="262" fontSize="7.5" style={mono} fill="currentColor" opacity="0.65">what remember() returns as flags; the memories themselves stay in the bank</text>
      </svg>
    </figure>
  );
}

function TheBank() {
  const [tick, setTick] = useState(0);
  return (
    <div className="space-y-12">
      <StepHeader
        kicker="Step 6a · Memory Bank"
        color={PURPLE}
        title="What the channel remembers about its creator."
        blurb="The agent has no memory of the creator yet. The more the creator uses it, the more it should remember about their preferences. This creator has a history: animals first, then gadgets, and lately fantasy. Memory Bank is where that history lives, and we will read it before generating the script."
      />

      <In delay={0.1}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Memory about a person</p>
          <h2 className="font-display mt-2 text-2xl">Facts about a person, kept under a scope.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            Memory Bank is a GEAP service that keeps facts about one user. The write is a generate call with the run's exchange: the service extracts the facts, embeds
            them, and merges each one into the matching memory it already has, or adds it as a new memory. The read is a retrieve call by scope. We will create two custom topics for it, CREATOR_TASTE and CHANNEL_RULES.
          </p>
          <div className="mt-4 overflow-x-auto">
            <BankFigure />
          </div>
        </section>
      </In>

      <In delay={0.2}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">MemoryBank configuration</p>
          <h2 className="font-display mt-2 text-2xl">The scope and the topics.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            Saving is the <code className="font-mono text-fg">memories.generate</code> call in <code className="font-mono text-fg">remember</code>. Under the hood:
          </p>
          <div className="mt-4 overflow-x-auto">
            <GenerateFigure />
          </div>
          <div className="mt-4 grid gap-4">
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">agent/platform/memory.py · scope and topics</div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
                <code>{CODE_TOPICS}</code>
              </pre>
            </div>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">agent/platform/memory.py · the write</div>
              <pre className="max-h-72 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
                <code>{CODE_REMEMBER}</code>
              </pre>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-fg-muted">
            A write is one <code className="font-mono text-fg">memories.generate</code> call with a conversation and the scope. Memory Bank
            extracts facts with a Gemini model, then embeds them so it can find the existing memories they resemble. That similarity is what
            drives consolidation, merge or update rather than duplicate, and it returns what it did: CREATED, UPDATED, or nothing new. A read
            is one <code className="font-mono text-fg">memories.retrieve</code> call with the scope; the same embeddings are what{" "}
            <code className="font-mono text-fg">similarity_search_params</code> searches over when you retrieve by a query instead of the whole
            scope, which this lab does not need. The bank lives on an Agent Engine resource in your project; its name is cached in{" "}
            <code className="font-mono text-fg">runs/memorybank.json</code>.
          </p>
        </section>
      </In>

      <In delay={0.3}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: PURPLE }}>
            Console
          </p>
          <h2 className="font-display mt-2 text-2xl">Create the bank, then load the creator's history.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            Each button runs the command shown as a process on this server and streams its output here; the copy button gives you the
            same line for a terminal at the repo root. The second one takes under a minute: four past sessions, each a generate call, and the
            print shows what consolidation kept.
          </p>
          <BankRunner onDone={() => setTick((t) => t + 1)} />
          <div className="flex flex-wrap gap-3">
            <SourceToggle path="agent/platform/bank.py" label="agent/platform/bank.py · the console: HISTORY and load()" />
            <SourceToggle path="agent/platform/memory.py" label="agent/platform/memory.py · the client: remember() makes the generate call" />
          </div>
        </section>
      </In>

      <In delay={0.4}>
        <BankLedger title="What consolidation kept." refreshKey={tick} />
      </In>
    </div>
  );
}

/* ───────────────────────── 6b ───────────────────────── */

const CALLBACKS = [
  { pair: "before_agent_callback / after_agent_callback", when: "Around the whole turn of an Agent.", sees: "CallbackContext: state, the session, the invocation.", override: "Return Content to replace the agent's reply, or None to keep it." },
  { pair: "before_model_callback / after_model_callback", when: "Around each model call the agent makes.", sees: "The LlmRequest about to go out, or the LlmResponse that came back.", override: "Return an LlmResponse to skip or replace the model's answer, or None to proceed." },
  { pair: "before_tool_callback / after_tool_callback", when: "Around each tool call.", sees: "The tool, its arguments, and its result.", override: "Return a dict to replace the tool's result, or None to proceed." },
];

const CALLBACK_POINTS = [
  { t: "before_model_callback", color: AMBER, d: "Runs on propose_directions right before its model call, with the request about to be sent. recall_taste appends the creator's memories to that request and returns None, so the call proceeds with them in front of the model." },
  { t: "after_agent_callback", color: PURPLE, d: "Runs on scripter once its turn is over. remember_pick reads the direction from state, hands one sentence about the pick to Memory Bank, and returns None, so the scripter's reply stands." },
];

const CODE_RECALL = `# agent/platform/memory.py
def recall_taste(callback_context, llm_request):
    """before_model_callback for propose_directions: read the creator's
    memories and put them in front of the model, oldest first, so the most
    recent taste is the last thing it reads. Returning None lets the model
    call proceed."""
    try:
        facts = recall()
    except Exception as e:  # noqa: BLE001 - a cloud hiccup is not a reason to stop the run
        print(f"  [memory] recall unavailable ({str(e)[:80]})")
        facts = []
    callback_context.state["memory_facts"] = facts
    if not facts:
        return None
    llm_request.append_instructions([
        "MEMORY - what Memory Bank knows about this creator, oldest first:\\n"
        + _lines(facts) + "\\n"
        "Lean candidates 1 to 3 toward the most recent CREATOR_TASTE and say so in the "
        "angle. CHANNEL_RULES are hard constraints for candidates 1 to 3. Candidate 4 is "
        "unaffected."])
    return None`;

const CODE_REMEMBER_PICK = `# agent/platform/memory.py
def remember_pick(callback_context):
    """after_agent_callback for scripter: the creator picked a direction and a
    script now exists for it. Hand that exchange to Memory Bank so the taste
    keeps moving. Returning None keeps the agent's own reply."""
    st = callback_context.state
    direction, angle = st.get("direction"), st.get("angle")
    if not direction:
        return None
    text = (f"Tonight the creator was offered four video directions and picked "
            f"'{direction}' ({angle}). A script was written for it. "
            f"This is what the creator wants to make right now.")
    try:
        flags = remember(text)
    except Exception as e:  # noqa: BLE001
        print(f"  [memory] remember unavailable ({str(e)[:80]})")
        flags = [{"action": "ERROR", "fact": str(e)[:120]}]
    st["memory_written"] = flags
    print(f"  [memory] {', '.join(f['action'] for f in flags) or 'nothing new'}")
    return None`;

/** One agent node's run as a line, with the hook before and after each of
 *  its three parts: the run itself, the model call, a tool call. The two
 *  this step uses are marked. */
function CallbacksFigure() {
  const box = { fill: "var(--overlay)", stroke: "var(--hairline)" };
  const mono = { fontFamily: "var(--font-mono)" } as const;
  const pill = (x: number, label: string, used?: boolean) => (
    <g>
      <rect x={x} y={100} width={92} height={26} rx={13} fill={used ? tint(PURPLE, 0.14) : box.fill} stroke={used ? PURPLE : box.stroke} strokeWidth={used ? 1.4 : 1} />
      <text x={x + 46} y={117} fontSize="8.5" style={mono} textAnchor="middle" fill={used ? PURPLE : "currentColor"}>{label}</text>
    </g>
  );
  const step = (x: number, label: string, sub: string) => (
    <g>
      <rect x={x} y={96} width={92} height={34} rx={8} fill={tint(CYAN, 0.1)} stroke={CYAN} strokeWidth="1.2" />
      <text x={x + 46} y={111} fontSize="9.5" style={mono} textAnchor="middle" fill={CYAN}>{label}</text>
      <text x={x + 46} y={124} fontSize="7.5" style={mono} textAnchor="middle" fill="currentColor" opacity="0.65">{sub}</text>
    </g>
  );
  const arrow = (x1: number, x2: number) => <line x1={x1} y1={113} x2={x2} y2={113} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.1" markerEnd="url(#cb-arrow)" />;
  const bracket = (x1: number, x2: number, y: number, label: string, color = "currentColor", op = 0.6) => (
    <g>
      <path d={`M${x1} ${y - 8} L${x1} ${y} L${x2} ${y} L${x2} ${y - 8}`} fill="none" stroke={color} strokeOpacity={op} strokeWidth="1" />
      <text x={(x1 + x2) / 2} y={y + 13} fontSize="8" style={mono} textAnchor="middle" fill={color} opacity={op + 0.2}>{label}</text>
    </g>
  );
  return (
    <figure className="m-0 min-w-[860px]">
      <svg viewBox="0 0 940 246" role="img" aria-label="One agent run, left to right: before_agent, then before_model, the model call, after_model, then, when the model asks for a tool, before_tool, the tool call, after_tool, and finally after_agent. This step uses before_model on propose_directions, where recall_taste adds the memories to the request, and after_agent on scripter, where remember_pick hands the pick to Memory Bank. A callback that returns None lets the run continue; a value replaces what would come next." className="h-auto w-full text-fg">
        <defs>
          <marker id="cb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <text x="20" y="22" fontSize="8.5" style={mono} fill="currentColor" opacity="0.65">one agent node runs · each hook is an Agent argument named &lt;hook&gt;_callback</text>
        <path d="M20 44 L20 36 L906 36 L906 44" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
        {pill(20, "before_agent")}
        {arrow(112, 126)}
        {pill(128, "before_model", true)}
        {arrow(220, 234)}
        {step(236, "model call", "the Gemini request")}
        {arrow(328, 342)}
        {pill(344, "after_model")}
        {arrow(436, 468)}
        {pill(470, "before_tool")}
        {arrow(562, 576)}
        {step(578, "tool call", "a Python function")}
        {arrow(670, 684)}
        {pill(686, "after_tool")}
        {arrow(778, 812)}
        {pill(814, "after_agent", true)}
        {bracket(128, 436, 146, "around the model call")}
        {bracket(470, 778, 146, "around a tool call · only when the model asks for one, once per call")}
        {/* the two used here */}
        <line x1="174" y1="126" x2="174" y2="186" stroke={PURPLE} strokeWidth="1.1" strokeDasharray="3 3" />
        <text x="20" y="200" fontSize="8.5" style={mono} fill={PURPLE}>before_model on propose_directions · recall_taste</text>
        <text x="20" y="213" fontSize="8" style={mono} fill="currentColor" opacity="0.7">reads the bank and appends the memories to the request, then returns None</text>
        <line x1="860" y1="126" x2="860" y2="186" stroke={PURPLE} strokeWidth="1.1" strokeDasharray="3 3" />
        <text x="906" y="200" fontSize="8.5" style={mono} textAnchor="end" fill={PURPLE}>after_agent on scripter · remember_pick</text>
        <text x="906" y="213" fontSize="8" style={mono} textAnchor="end" fill="currentColor" opacity="0.7">hands the pick to Memory Bank, then returns None</text>
        <text x="463" y="238" fontSize="8" style={mono} textAnchor="middle" fill="currentColor" opacity="0.6">return None: the run continues as normal · return a value: it replaces what would have come next</text>
      </svg>
    </figure>
  );
}

function TheCallbacks() {
  const [idea, setIdea] = useState("");
  const [hintA, setHintA] = useState(0);
  const [hintB, setHintB] = useState(0);
  const [status, setStatus] = useState<Stage4Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<{ ok: boolean; edges?: number; error: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const { snapshot } = useRunEvents();
  const check = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await api.labStage4());
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
  const runLoad = async () => {
    setLoading(true);
    try {
      setLoad(await api.labStage4Load());
    } finally {
      setLoading(false);
    }
  };
  const recallOk = status?.recall_wired ?? false;
  const rememberOk = status?.remember_wired ?? false;
  const facts = status?.memory_facts ?? [];
  const written = status?.memory_written ?? [];

  return (
    <div className="space-y-12">
      <StepHeader
        kicker="Step 6b · Callbacks"
        color={PURPLE}
        title="Callbacks: code at fixed points in an agent's turn."
        blurb="An Agent lets you attach functions that ADK runs at set moments: around the turn, around each model call, around each tool call. Memory uses two of them, and the step 5 graph keeps its shape."
      />

      <CatchUp needs={["GATE_INPUT", "PERSIST_STATE", "POLICY_ROUTE"]} color={PURPLE} />

      <In delay={0.05}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">The workflow so far</p>
          <h2 className="font-display mt-2 text-2xl">The same graph, with memory on propose_directions and the scripter.</h2>
          <WorkflowFigure />
        </section>
      </In>

      <In delay={0.1}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">ADK callbacks</p>
          <h2 className="font-display mt-2 text-2xl">Hooks before and after the model, the agent, and a tool.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            A callback is a plain function passed as an argument to <code className="font-mono text-fg">Agent</code>. ADK calls it at a
            fixed point with the objects in play at that point, and reads its return value: <code className="font-mono text-fg">None</code>{" "}
            means continue as normal, anything else replaces what would have happened next. That makes callbacks the place for guardrails,
            logging, caching, and, as here, giving an agent context it did not ask for.
          </p>
          <div className="mt-4 overflow-x-auto">
            <CallbacksFigure />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="py-2 pr-4">Pair</th>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">What it sees</th>
                  <th className="py-2">Return value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {CALLBACKS.map((c) => (
                  <tr key={c.pair}>
                    <td className="py-2 pr-4 font-mono text-[11px]" style={{ color: PURPLE }}>
                      {c.pair}
                    </td>
                    <td className="py-2 pr-4 text-fg-muted">{c.when}</td>
                    <td className="py-2 pr-4 text-fg-muted">{c.sees}</td>
                    <td className="py-2 text-fg-muted">{c.override}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </In>

      <In delay={0.15}>
        <section className="grid gap-3 md:grid-cols-2">
          {CALLBACK_POINTS.map((p, i) => (
            <motion.div key={p.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="rounded-3xl border border-hairline bg-card p-5">
              <p className="font-mono text-sm font-semibold" style={{ color: p.color }}>
                {p.t}
              </p>
              <p className="mt-2 text-sm text-fg-muted">{p.d}</p>
            </motion.div>
          ))}
        </section>
      </In>

      <In delay={0.2}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">The callbacks</p>
          <h2 className="font-display mt-2 text-2xl">Read before propose_directions, write after the scripter.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            <code className="font-mono text-fg">recall_taste</code> retrieves the creator's memories, oldest first, appends them to the model
            request with one instruction, lean toward the most recent taste and treat the rules as constraints, and stores what it read in
            state so the verify panel can show it. <code className="font-mono text-fg">remember_pick</code> reads the direction from state, the
            one <code className="font-mono text-fg">persist_direction</code> wrote, composes one sentence about tonight's pick, and hands it to{" "}
            <code className="font-mono text-fg">remember</code>. Both return <code className="font-mono text-fg">None</code>, which tells ADK to
            carry on as normal.
          </p>
          <div className="mt-4 grid gap-4">
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">before the model call of propose_directions</div>
              <pre className="max-h-[420px] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
                <code>{CODE_RECALL}</code>
              </pre>
            </div>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">after the scripter's turn</div>
              <pre className="max-h-[420px] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
                <code>{CODE_REMEMBER_PICK}</code>
              </pre>
            </div>
          </div>
        </section>
      </In>

      <In delay={0.3}>
        <EditPanel
          label="Edit 1 of 2"
          title="Give propose_directions its memory."
          intro={<>Only <code className="font-mono text-fg">propose_directions</code> is shown, in this step's app, <code className="font-mono text-fg">stage4_memory</code>. Add one keyword argument: <code className="font-mono text-fg">before_model_callback=recall_taste</code>.</>}
          pill={status ? (recallOk ? "recall_taste wired ✓" : status.recall_kw ? `before_model_callback=${status.recall_kw}` : "no before_model_callback") : "…"}
          ok={recallOk}
          hint={hintA}
          setHint={setHintA}
          hint1={<>Replace the TODO comment on the last line with a comma and the argument. <code className="font-mono">recall_taste</code> is imported at the top of the file.</>}
          hint2={`propose_directions = Agent(
    name="propose_directions",
    model=config.MODEL,
    instruction=PROPOSE_INSTRUCTION,
    output_schema=Directions,
    before_model_callback=recall_taste)`}
          path="stage4_memory/agent.py"
          symbol="propose_directions"
          pattern={/TODO: MEMORY_RECALL|before_model_callback/}
          onSaved={check}
        />
      </In>

      <In delay={0.35}>
        <EditPanel
          label="Edit 2 of 2"
          title="Let the scripter remember the pick."
          intro={<>Only <code className="font-mono text-fg">scripter</code> is shown. Add <code className="font-mono text-fg">after_agent_callback=remember_pick</code>.</>}
          pill={status ? (rememberOk ? "remember_pick wired ✓" : status.remember_kw ? `after_agent_callback=${status.remember_kw}` : "no after_agent_callback") : "…"}
          ok={rememberOk}
          hint={hintB}
          setHint={setHintB}
          hint1={<>Same move as edit 1, on the scripter, with the other callback name.</>}
          hint2={`scripter = Agent(
    name="scripter",
    model=config.MODEL,
    instruction=SCRIPT_INSTRUCTION,
    output_schema=Script,
    after_agent_callback=remember_pick)`}
          path="stage4_memory/agent.py"
          symbol="scripter"
          pattern={/TODO: MEMORY_REMEMBER|after_agent_callback/}
          onSaved={check}
        />
      </In>

      <In delay={0.4}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Before you run</p>
              <p className="mt-1 max-w-2xl text-sm text-fg-muted">Save both edits, then click the button. It loads your saved file the way adk web will and tells you either that it loads or what ADK objects to.</p>
            </div>
            <button onClick={runLoad} className="flex items-center gap-2 rounded-xl border border-hairline bg-overlay px-4 py-2 font-mono text-xs text-fg-muted hover:text-fg">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Check the workflow loads
            </button>
          </div>
          {load && (
            <div className="mt-3 rounded-xl border p-3 font-mono text-[11.5px]" style={load.ok ? { borderColor: tint(GREEN, 0.4), color: GREEN, background: tint(GREEN, 0.06) } : { borderColor: tint(RED, 0.4), color: RED, background: tint(RED, 0.06) }}>
              {load.ok ? `loads · ${load.edges} edges` : load.error}
            </div>
          )}
        </section>
      </In>

      <In delay={0.45}>
        <RunPanel
          app="stage4_memory"
          open={open}
          setOpen={setOpen}
          title="Run it with no idea, then with one."
          intro="Leave the chat box empty on the first run so propose_directions works from the backlog, the trends, and the memory alone. Each run is two model calls, propose_directions and the scripter, plus the memory read and write."
          idea={idea}
          setIdea={setIdea}
          steps={[
            "Send an empty message. Open the propose_directions event: the request carries a MEMORY block with the three eras, and candidates 1 to 3 lean toward fantasy, the most recent taste, while the trends say something else. Pick one.",
            "After the scripter, the memory write runs. Click Show the bank below: one memory changed or was added, and it says what you picked tonight. Run again with an idea of your own and watch the lean follow it.",
          ]}
        />
      </In>

      <In delay={0.5}>
        <VerifyPanel checking={checking} onCheck={check} intro="Read from stage4_memory/agent.py, runs/memorybank.json, and the latest stage4_memory session's state.">
          <CheckRow ok={recallOk} label="propose_directions has before_model_callback=recall_taste">
            {status ? (recallOk ? "Found in the file." : "Edit 1 above.") : "…"}
          </CheckRow>
          <CheckRow ok={rememberOk} label="scripter has after_agent_callback=remember_pick">
            {status ? (rememberOk ? "Found in the file." : "Edit 2 above.") : "…"}
          </CheckRow>
          <CheckRow ok={!!status?.bank_connected} label="A Memory Bank is connected">
            {status ? (status.bank_connected ? "runs/memorybank.json names the Agent Engine." : "Run python -m agent.platform.bank first (6a).") : "…"}
          </CheckRow>
          <CheckRow ok={facts.length > 0} label="propose_directions read memories on the latest run">
            {facts.length ? `${facts.length} memories read · newest: ${facts[facts.length - 1].fact.slice(0, 90)}` : "None read yet."}
          </CheckRow>
          <CheckRow ok={written.some((w) => w.action && w.action !== "ERROR")} label="The scripter wrote tonight's pick to the bank">
            {written.length ? written.map((w) => `${w.action}${w.fact ? `: ${w.fact.slice(0, 70)}` : ""}`).join("  ·  ") : status?.direction ? "The write runs after the scripter; wait for the run to finish." : "Not yet."}
          </CheckRow>
        </VerifyPanel>
      </In>

    </div>
  );
}
