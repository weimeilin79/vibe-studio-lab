import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Copy, ExternalLink, Lightbulb, RefreshCw, TerminalSquare, X } from "lucide-react";
import { CodeEditor } from "../components/CodeEditor";
import { In, StepHeader } from "../components/shared";
import { LoadCheck } from "../components/LoadCheck";
import { api, useRunEvents } from "../lib/api";
import type { InspectorStatus, Stage0Status } from "../lib/types";
import { AdkGlance } from "./AdkGlance";
import { COLORS, tint } from "./colors";

/*
 * Step 3, in three parts:
 *   3a  what an ADK agent is (AdkGlance)
 *   3b  the single-prompt agent in stage0_prompt/agent.py: model, instruction, tools
 *   3c  where the research comes from, then the hands-on edit: add the two
 *       tools to tools=[] in the in-page editor, run the agent in adk web,
 *       and verify from the session store.
 */

const BLUE = COLORS.blue;
const PURPLE = COLORS.purple;
const CYAN = COLORS.cyan;
const AMBER = COLORS.amber;
const GREEN = COLORS.green;

type Part = "a" | "b" | "c";
const PARTS: { id: Part; label: string }[] = [
  { id: "a", label: "ADK at a glance" },
  { id: "b", label: "The single-prompt agent" },
  { id: "c", label: "Tools, edit, run" },
];

export function SinglePrompt() {
  const { part: partParam } = useParams();
  const part: Part = PARTS.some((p) => p.id === partParam) ? (partParam as Part) : "a";
  const idx = PARTS.findIndex((p) => p.id === part);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [part]);

  return (
    <div className="space-y-8">
      {part === "a" && <AdkGlance />}
      {part === "b" && <TheAgent />}
      {part === "c" && <ToolsEditRun />}

      <div className="flex items-center justify-center gap-3 pt-2">
        {idx > 0 ? (
          <Link
            to={`/step/single-prompt/${PARTS[idx - 1].id}`}
            className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-fg-muted hover:text-fg"
          >
            ← 3{PARTS[idx - 1].id} · {PARTS[idx - 1].label}
          </Link>
        ) : (
          <span />
        )}
        {idx < PARTS.length - 1 && (
          <Link
            to={`/step/single-prompt/${PARTS[idx + 1].id}`}
            className="flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-black"
            style={{ background: BLUE }}
          >
            Continue to 3{PARTS[idx + 1].id} · {PARTS[idx + 1].label} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── 3b ───────────────────────── */

const JOBS = [
  "check what is trending",
  "look at your backlog of ideas",
  "propose a direction and agree on it with the creator",
  "refuse blacklisted subjects (competitor, hateful, gore)",
  "describe the video: a title and 3 shots",
];

const CODE_AGENT = `# stage0_prompt/agent.py
from google.adk import Agent
from agent.platform import config

root_agent = Agent(
    name="solo_channel", model=config.MODEL,     # model: gemini-3-flash-preview
    tools=[],  # TODO: TOOLS                     # tools: empty for now (3c)
    instruction=(                                # instruction: the pipeline as prose
        "You run the creator's short-video channel, alone.\\n"
        "When the creator gives you an idea (or nothing), do ALL of this:\\n"
        "check what is trending. look at your backlog of ideas. propose a "
        "direction and agree on it with the creator. refuse blacklisted "
        "subjects (competitor, hateful, gore). then describe the video you "
        "would make: a title (<=60 chars) and 3 shots, one visual sentence "
        "each.\\n"
        "Ask the creator to confirm the direction before describing the "
        "video."))`;

function TheAgent() {
  return (
    <div className="space-y-10">
      <StepHeader
        kicker="Step 3b · The single-prompt agent"
        color={BLUE}
        title="The whole pipeline as one agent."
        blurb="Before building the graph, meet the simplest version: one Agent whose instruction describes the entire pipeline in prose. It uses three of the fields from 3a."
      />

      <In delay={0.1}>
        <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-3xl border border-hairline bg-card p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">
              stage0_prompt/agent.py · <span style={{ color: BLUE }}>root_agent</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px]">
              <Chip color={CYAN}>model = gemini-3-flash-preview</Chip>
              <Chip color={BLUE}>instruction = five jobs, as sentences</Chip>
              <Chip color={PURPLE}>tools = [ ]</Chip>
            </div>
            <p className="mt-5 text-sm text-fg-muted">
              <b className="text-fg">model</b> is set once for the lab in <code className="font-mono">agent/platform/config.py</code>.
              adk web discovers this agent because the folder contains an <code className="font-mono">agent.py</code>{" "}
              that exports <code className="font-mono">root_agent</code>; the folder name becomes the app name.
            </p>
            <p className="mt-4 text-sm text-fg-muted">
              <b className="text-fg">instruction</b> is the system prompt. Here it lists the pipeline as five sentences,
              each one a job the model is asked to perform inside a single conversation:
            </p>
            <ol className="mt-3 space-y-2">
              {JOBS.map((j, i) => (
                <motion.li
                  key={j}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.07 }}
                  className="flex items-start gap-3 rounded-xl border border-hairline bg-overlay px-3 py-2 text-sm"
                >
                  <span className="font-mono text-[10px] text-fg-muted">{i + 1}</span>
                  <span className="italic">{j}</span>
                </motion.li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-fg-muted">
              The last line asks the model to confirm the direction with you before describing the video. That request
              is text. Nothing in the code enforces it.
            </p>
            <p className="mt-4 text-sm text-fg-muted">
              <b className="text-fg">tools</b> is empty. The first two jobs need data the model does not have, so the agent can only guess at trends and invent a backlog. In 3c you give it the two functions
              that fetch the real data. Both sources are below.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-hairline bg-card">
            <div className="border-b border-hairline bg-overlay px-4 py-2 font-mono text-[11px] text-fg-muted">
              stage0_prompt/agent.py
            </div>
            <pre className="overflow-x-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed text-fg">
              <code>{CODE_AGENT}</code>
            </pre>
          </div>
        </section>
      </In>

      <In delay={0.3}>
        <Sources />
      </In>
    </div>
  );
}

/** The two research sources the whole lab reads: the creator's backlog and
 *  what is trending. Live from this server, so what you see is what the
 *  agent will get. */
function Sources() {
  const [backlog, setBacklog] = useState<string[] | null>(null);
  const [trends, setTrends] = useState<{ topic: string; heat: number }[] | null>(null);
  const loadTrends = useCallback(async () => {
    try {
      const r = await fetch("/api/lab/trends");
      setTrends(((await r.json()) as { trends: { topic: string; heat: number }[] }).trends);
    } catch {
      setTrends([]);
    }
  }, []);
  useEffect(() => {
    api.getCode("agent/backlog.txt").then((f) => setBacklog(f.content.split("\n").filter((l: string) => l.trim() && !l.startsWith("#")))).catch(() => setBacklog([]));
    loadTrends();
  }, [loadTrends]);
  return (
    <section className="rounded-3xl border border-hairline bg-card p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">The sources</p>
      <h2 className="font-display mt-2 text-2xl">The backlog, and what is trending.</h2>
      <p className="mt-2 max-w-3xl text-sm text-fg-muted">
        The creator keeps a backlog: ideas noted down to make someday, one per line in{" "}
        <code className="font-mono text-fg">agent/backlog.txt</code>. The platform reports what is trending: ten formats at a time, a style or a twist an idea can ride,
        drawn from a pool of 250, each with a heat score, a different ten on every call. The job of the pipeline is to combine
        the two: find the backlog ideas closest to what the creator wants tonight, and ride the trend that fits them.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
          <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">agent/backlog.txt · the creator's notes</div>
          <ol className="max-h-80 overflow-auto px-4 py-3 text-sm">
            {(backlog ?? []).map((n, i) => (
              <li key={n} className="flex gap-3 py-1">
                <span className="w-5 shrink-0 text-right font-mono text-[10px] text-fg-muted">{i + 1}</span>
                <span>{n}</span>
              </li>
            ))}
            {backlog === null && <li className="text-fg-muted">…</li>}
          </ol>
        </div>
        <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">GET /api/lab/trends · ten right now</span>
            <button onClick={loadTrends} className="font-mono text-[11px] text-fg-muted hover:text-fg">
              another ten
            </button>
          </div>
          <ol className="max-h-80 overflow-auto px-4 py-3 text-sm">
            {(trends ?? []).map((t) => (
              <li key={t.topic} className="flex items-center gap-3 py-1">
                <span className="w-7 shrink-0 rounded px-1 text-center font-mono text-[10px]" style={{ background: tint(AMBER, 0.13), color: AMBER }}>
                  {t.heat}
                </span>
                <span>{t.topic}</span>
              </li>
            ))}
            {trends === null && <li className="text-fg-muted">…</li>}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 3c ───────────────────────── */

const CODE_PLATFORM = `# agent/trends.py
FORMATS = [ "one continuous take, no cuts", "a heist for something worthless", ... ]   # fifty
LOWPOLY_LOOKS = [ "cozy low-poly faceted 3D, warm pastels ...", ... ]                  # the channel's own look
OTHER_LOOKS = [ "claymation with visible thumbprints ...", "1990s VHS home video ...", ... ]
TREND_POOL = [f"{fmt} · look: {_look(i, j)}" for i, fmt in enumerate(FORMATS) for j in range(5)]   # 250

def sample_trends(n=10) -> list[dict]:
    picks = random.sample(TREND_POOL, n)          # a different ten every call
    heats = sorted(random.sample(range(40, 100), n), reverse=True)
    return [{"topic": t, "heat": h} for t, h in zip(picks, heats)]

# agent/graph.py
def backlog_notes() -> list[str]:
    return [l.strip() for l in BACKLOG_FILE.read_text().splitlines()
            if l.strip() and not l.startswith("#")]      # agent/backlog.txt`;

const DEFAULT_IDEA = "a tiny robot doing laundry at midnight";
const INSPECTOR_URL = "/inspector/dev-ui/?app=stage0_prompt";

function ToolsEditRun() {
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(0);
  const [inspector, setInspector] = useState<InspectorStatus | null>(null);
  const [status, setStatus] = useState<Stage0Status | null>(null);
  const [checking, setChecking] = useState(false);
  const { snapshot } = useRunEvents();

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await api.labStage0());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    api.labInspector().then(setInspector).catch(() => setInspector({ up: false, url: "/inspector/dev-ui/", apps: [] }));
    check();
  }, [check]);

  // sessions.db changes publish a snapshot; re-read the evidence then.
  useEffect(() => {
    if (snapshot) check();
  }, [snapshot?.updated_at, check]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // the dev UI writes to sessions.db outside this server's run loop; poll
    // while it is open so the verify rows follow the student's run
    if (!open) return;
    const t = setInterval(check, 4000);
    return () => clearInterval(t);
  }, [open, check]);

  const prompt = `tonight's idea: ${idea.trim() || DEFAULT_IDEA}`;
  const wired = status?.tools_complete ?? false;

  return (
    <div className="space-y-12">
      <StepHeader
        kicker="Step 3c · Tools, edit, run"
        color={BLUE}
        title="Python functions behind an HTTP contract."
        blurb="Give the agent its two research tools, run it in adk web, and check from the session store what it actually did."
      />

      {/* where the research comes from */}
      <In delay={0.1}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Where the research comes from</p>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            The two functions are in <code className="font-mono text-fg">stage0_prompt/agent.py</code>. ADK turns
            each function passed in <code className="font-mono text-fg">tools=[...]</code> into a tool declaration from its
            name, signature, and docstring. When the model decides it needs the data, it emits a{" "}
            <code className="font-mono text-fg">function_call</code>; ADK runs the function and appends a{" "}
            <code className="font-mono text-fg">function_response</code> event with the return value; the model continues
            with that data in context.
          </p>

          <div className="mt-6 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            <FlowBox color={CYAN} title="Gemini" sub="the model, inside the agent">
              decides a tool is needed and emits <b>function_call</b> · reads the <b>function_response</b> and writes prose
            </FlowBox>
            <Arrow label="function_call" />
            <FlowBox color={PURPLE} title="the tools" sub="stage0_prompt/agent.py">
              <b>check_trends()</b>
              <br />
              <b>read_backlog()</b>
              <br />
              plain Python, no model
            </FlowBox>
            <Arrow label="Python call" />
            <FlowBox color={BLUE} title="the sources" sub="agent/trends.py · agent/backlog.txt">
              <b>sample_trends()</b>: ten of 250, a format and a look each
              <br />
              <b>backlog_notes()</b>: reads the notes file
            </FlowBox>
            <Arrow label="returns" />
            <FlowBox color={GREEN} title="the data" sub="beside the graph, no network">
              ten trends with a heat score, hottest first
              <br />
              fifteen backlog notes, one per line
            </FlowBox>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-hairline">
              <div className="border-b border-hairline bg-overlay px-4 py-2 font-mono text-[11px] text-fg-muted">agent/trends.py · agent/graph.py</div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed text-fg">
                <code>{CODE_PLATFORM}</code>
              </pre>
            </div>
            <ul className="space-y-3 text-sm text-fg-muted">
              <li>
                <b className="text-fg">Trends</b> are what is moving on the platform right now: a format paired with a look, never a
                subject. The pool beside the graph holds 250; every call draws ten with a heat score, so no two runs see the same
                ten. A quarter of the looks are the channel's own cozy low-poly; the rest range from claymation to film noir.
              </li>
              <li>
                <b className="text-fg">The backlog</b> is the creator's own notes, fifteen ideas in{" "}
                <code className="font-mono text-fg">agent/backlog.txt</code>, one per line. Add a line and the next call
                returns it.
              </li>
              <li>
                <b className="text-fg">The same two sources</b> feed the graph in step 4. Only the shape changes: there
                they are nodes that always run; here they are tools the model may or may not call.
              </li>
            </ul>
          </div>
        </section>
      </In>

      {/* the edit */}
      <In delay={0.2}>
        <section className="rounded-3xl border p-6" style={{ borderColor: tint(AMBER, 0.4), background: tint(AMBER, 0.04) }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: AMBER }}>
                Your edit
              </p>
              <h2 className="font-display mt-2 text-2xl">Add the tools to the agent.</h2>
              <p className="mt-2 max-w-2xl text-sm text-fg-muted">
                The highlighted line has an empty <code className="font-mono text-fg">tools=[]</code>. Put the two
                functions defined above it into that list. Saving writes the file; adk web reloads the agent on the next message.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full border px-3 py-1 font-mono text-[11px]"
                style={wired ? { borderColor: tint(GREEN, 0.4), color: GREEN, background: tint(GREEN, 0.08) } : { borderColor: "var(--hairline)", color: "var(--fg-muted)" }}
              >
                {status ? (wired ? "tools wired ✓" : `wired: ${status.tools_wired.length ? status.tools_wired.join(", ") : "none"}`) : "…"}
              </span>
              <button
                onClick={() => setHint((h) => Math.min(h + 1, 2))}
                className="flex items-center gap-1.5 rounded-full border border-hairline bg-card px-3 py-1 text-xs text-fg-muted hover:text-fg"
              >
                <Lightbulb size={13} /> {hint === 0 ? "Hint" : hint === 1 ? "Another hint" : "Hints shown"}
              </button>
            </div>
          </div>

          {hint >= 1 && (
            <div className="mt-4 rounded-2xl border border-hairline bg-card p-4 text-sm text-fg-muted">
              <p>
                <b className="text-fg">Hint 1.</b> The list takes the function objects themselves, not strings and not
                calls. Write the two names separated by a comma, exactly as they are spelled in the{" "}
                <code className="font-mono">def</code> lines above.
              </p>
              {hint >= 2 && (
                <p className="mt-2">
                  <b className="text-fg">Hint 2.</b> The finished line is{" "}
                  <code className="rounded bg-overlay px-1.5 py-0.5 font-mono text-fg">tools=[check_trends, read_backlog],</code>{" "}
                  and the TODO comment can go.
                </p>
              )}
            </div>
          )}

          <div className="mt-4">
            <CodeEditor path="stage0_prompt/agent.py" accent={AMBER} highlightPattern={/^\s*tools=\[/} onSaved={() => check()} />
          </div>
        </section>
      </In>

      <In delay={0.25}>
        <LoadCheck app="stage0_prompt" intro="Save the tools edit, then click the button. It loads stage0_prompt the way adk web will and tells you either that it loads or what ADK objects to." />
      </In>

      {/* run it */}
      <In delay={0.3}>
        <section className="rounded-3xl border p-6" style={{ borderColor: tint(BLUE, 0.33), background: tint(BLUE, 0.04) }}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: BLUE }}>
                Run it
              </p>
              <h2 className="font-display mt-2 text-2xl">Open adk web and talk to the agent.</h2>
              <p className="mt-2 max-w-2xl text-sm text-fg-muted">
                adk web is ADK's development UI. It is mounted inside this app at <code className="font-mono">/inspector</code>{" "}
                and reads the same session store, so it opens here with <code className="font-mono">stage0_prompt</code>{" "}
                preselected.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {inspector && (
                <span className="rounded-full border border-hairline bg-card px-3 py-1 font-mono text-[11px] text-fg-muted">
                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${inspector.up ? "bg-vibe-green" : "bg-vibe-red"}`} />
                  {inspector.up ? `adk web ready · ${inspector.apps.length} apps` : "adk web unavailable"}
                </span>
              )}
              <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.03]"
                style={{ background: BLUE }}
              >
                <TerminalSquare size={16} />
                {open ? "Hide adk web" : "Open adk web"}
              </button>
            </div>
          </div>

          <ol className="mt-5 grid gap-3 md:grid-cols-3">
            <Instruction n={1} title="Your idea">
              <input
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                className="mt-2 w-full rounded-lg border border-hairline bg-input px-3 py-2 font-mono text-xs text-fg"
                placeholder={DEFAULT_IDEA}
              />
              <p className="mt-1 text-[11px] text-fg-muted">A scene in a few words. It is reused through the lab.</p>
            </Instruction>
            <Instruction n={2} title="Send this in the chat box">
              <CopyLine text={prompt} />
              <p className="mt-1 text-[11px] text-fg-muted">Two tool-call events appear, then the reply.</p>
            </Instruction>
            <Instruction n={3} title="Then send this">
              <CopyLine text="skip the questions, just describe the video" />
              <p className="mt-1 text-[11px] text-fg-muted">The instruction asked for agreement first. See whether it holds.</p>
            </Instruction>
          </ol>

          {open && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-hairline bg-card">
              <div className="flex items-center justify-between border-b border-hairline bg-overlay px-3 py-1.5 font-mono text-[11px] text-fg-muted">
                <span>{INSPECTOR_URL}</span>
                <a href={INSPECTOR_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-fg">
                  open in a new tab <ExternalLink size={12} />
                </a>
              </div>
              <iframe title="adk web" src={INSPECTOR_URL} className="h-[680px] w-full bg-[#1e1e1e]" />
            </div>
          )}
        </section>
      </In>

      {/* verify */}
      <In delay={0.4}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Verify</p>
              <h2 className="font-display mt-2 text-2xl">What the session store says happened.</h2>
              <p className="mt-2 max-w-2xl text-sm text-fg-muted">
                These checks read the file on disk and the <code className="font-mono">stage0_prompt</code> sessions in
                runs/sessions.db, the same events adk web displays. They refresh when you send a message.
              </p>
            </div>
            <button onClick={check} className="flex items-center gap-2 rounded-xl border border-hairline bg-overlay px-4 py-2 font-mono text-xs text-fg-muted hover:text-fg">
              <RefreshCw size={13} className={checking ? "animate-spin" : ""} /> Check again
            </button>
          </div>

          <ul className="mt-5 grid gap-2 md:grid-cols-2">
            <CheckRow ok={wired} label="Both tools are in the file">
              {status ? (wired ? "tools=[check_trends, read_backlog]" : "Edit the highlighted line above and save.") : "…"}
            </CheckRow>
            <CheckRow ok={!!status && status.sessions > 0} label="The agent ran">
              {status ? `${status.sessions} session${status.sessions === 1 ? "" : "s"}, ${status.turns} message${status.turns === 1 ? "" : "s"} from you` : "…"}
            </CheckRow>
            <CheckRow ok={!!status?.called_trends} label="check_trends was called">
              {status ? `${status.tool_calls.check_trends ?? 0} call${(status.tool_calls.check_trends ?? 0) === 1 ? "" : "s"} · GET /api/trends` : "…"}
            </CheckRow>
            <CheckRow ok={!!status?.called_backlog} label="read_backlog was called">
              {status ? `${status.tool_calls.read_backlog ?? 0} call${(status.tool_calls.read_backlog ?? 0) === 1 ? "" : "s"} · reads agent/backlog.txt, 15 notes` : "…"}
            </CheckRow>
          </ul>

          {status?.last_reply && (
            <div className="mt-5 rounded-2xl border border-hairline bg-overlay p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">Latest reply</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-fg-muted">{status.last_reply}</p>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-hairline p-4 text-sm text-fg-muted">
            <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">Read the reply yourself</p>
            <ul className="mt-2 space-y-1.5">
              <li>The research is prose. Which source produced which claim is not recoverable from the text.</li>
              <li>If the reply declares the topic safe, the model that proposed it also certified it. No code checked.</li>
              <li>After the second message, see whether the agent described the video without your confirmation. The instruction asked for it; nothing enforced it.</li>
            </ul>
          </div>
        </section>
      </In>

      <In delay={0.55}>
        <div className="mx-auto max-w-3xl rounded-2xl border border-hairline bg-card/60 px-6 py-5 text-center text-sm text-fg-muted">
          This design works for a one-off demo. It does not give you inspectable research, an enforced pause, or a
          verifiable check. Step 4 replaces the first two sentences with nodes that always run, in parallel, and whose
          output is a payload you can open.
        </div>
      </In>
    </div>
  );
}

/* ───────────────────────── bits ───────────────────────── */

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="rounded-md px-2 py-1" style={{ background: tint(color, 0.1), color, border: `1px solid ${tint(color, 0.27)}` }}>
      {children}
    </span>
  );
}

function FlowBox({ color, title, sub, children }: { color: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: tint(color, 0.4), background: tint(color, 0.06) }}>
      <div className="text-sm font-semibold" style={{ color }}>
        {title}
      </div>
      <div className="font-mono text-[10px] text-fg-muted">{sub}</div>
      <div className="mt-2 text-xs leading-relaxed text-fg-muted [&_b]:font-mono [&_b]:text-fg">{children}</div>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-1 text-fg-muted">
      <ArrowRight size={16} className="rotate-90 md:rotate-0" />
      <span className="font-mono text-[9px] uppercase tracking-wider">{label}</span>
    </div>
  );
}

function Instruction({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-hairline bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-bold text-black" style={{ background: BLUE }}>
          {n}
        </span>
        {title}
      </div>
      {children}
    </li>
  );
}

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-hairline bg-input px-3 py-2 text-left font-mono text-xs text-fg hover:border-vibe-cyan/60"
      title="Copy"
    >
      <span className="truncate">{text}</span>
      {copied ? <Check size={13} className="shrink-0 text-vibe-green" /> : <Copy size={13} className="shrink-0 text-fg-muted" />}
    </button>
  );
}

function CheckRow({ ok, label, tone = "good", children }: { ok: boolean; label: string; tone?: "good" | "warn"; children: React.ReactNode }) {
  const color = ok ? (tone === "warn" ? AMBER : GREEN) : "var(--fg-muted)";
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-hairline bg-overlay p-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: color, color, background: ok ? tint(color, 0.1) : "transparent" }}>
        {ok ? <Check size={13} /> : <X size={12} className="opacity-40" />}
      </span>
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-fg-muted">{children}</div>
      </div>
    </li>
  );
}
