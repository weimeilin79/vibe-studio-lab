import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, RefreshCw, Rocket } from "lucide-react";
import { In, StepHeader } from "../components/shared";
import { api, useRunEvents } from "../lib/api";
import type { DeployStatus } from "../lib/types";
import { COLORS, tint } from "./colors";

/*
 * Step 9: the Runner, the app on top of the workflow, Cloud Run. One part:
 * read how the app drives the graph, run it locally, deploy it with a button.
 */

const GREEN = COLORS.green;
const CYAN = COLORS.cyan;
const AMBER = COLORS.amber;
const PURPLE = COLORS.purple;
const RED = COLORS.red;
const mono = { fontFamily: "var(--font-mono)" } as const;

const RUNNER_POINTS = [
  { t: "The Runner", d: "adk web was a Runner with a page. A Runner takes an app name, the agent or workflow, and a session service; run_async(user_id, session_id, new_message) yields every event the graph produces and stores them in the session. The app is the same loop with a different page." },
  { t: "The app's shape", d: "vibestudio/server: a FastAPI process with a bus, a runner, a publisher, an avatar job, and the files. vibestudio/web: a React page. vibestudio/server/agent: the finished agent, byte for byte the lab's solution, so the app works whether or not every hole in the lab is filled." },
  { t: "One stream", d: "Every change is one event on the bus, and /api/events streams the bus. Each event carries the folded run state after it, so a page that connects late is current from its first message, and the page never reconstructs anything." },
  { t: "Cloud Run", d: "A container from the Dockerfile, built by Cloud Build, served at one URL. The two resource names travel as env vars; the render poller and the publisher run inside the same process, so one instance with session affinity holds the run." },
];

const CODE_RUNNER = `# vibestudio/server/runner.py
self._svc = DatabaseSessionService(db_url=config.DB_URL)
self._runner = Runner(app_name=config.APP, agent=wf, session_service=self._svc)

async def _leg(self, message, fresh=False):
    if fresh:
        await self._svc.create_session(app_name=config.APP, user_id=config.USER, session_id=st.run_id)
    async for ev in self._runner.run_async(user_id=config.USER, session_id=st.run_id, new_message=message):
        self._absorb(ev)          # fold the ADK event into RunState, publish one app event
    self._settle()                # waiting_pick, rendering, or done

# the gate's answer and the render's delivery are the same call with a function_response
part = Part(function_response=FunctionResponse(id=call_id, name=name, response=response))
await self._leg(Content(role="user", parts=[part]))`;

const CODE_EVENT = `// one message on GET /api/events
{"type": "gate.open", "seq": 14, "at": 1788756422.1,
 "message": "Pick tonight's direction: 1, 2, 3 or 4.",
 "candidates": [{"title": "...", "angle": "...", "hook": "...", "sources": ["backlog", "feedback", "trends"]}, ...],
 "state": {"status": "waiting_pick", "run_id": "run_1788756405", "active": "direction_gate",
           "nodes_seen": ["scan_trends", "read_backlog", "read_feedback", "join_research", "propose_directions", "direction_gate"],
           "research": {"trends": [...], "backlog": 15, "feedback": [...]}, "memory_facts": 4, ...}}`;

function ArchFigure() {
  const box = (x: number, y: number, w: number, h: number, label: string, sub: string, color: string) => (
    <g key={label}>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={tint(color, 0.08)} stroke={color} strokeOpacity="0.7" />
      <text x={x + w / 2} y={y + 20} textAnchor="middle" fontSize="11" style={mono} fill={color}>{label}</text>
      <text x={x + w / 2} y={y + 36} textAnchor="middle" fontSize="8.5" style={mono} fill="currentColor" opacity="0.65">{sub}</text>
    </g>
  );
  return (
    <figure className="m-0 mt-4">
      <svg viewBox="0 0 900 230" className="h-auto w-full text-fg" role="img" aria-label="The app: the React page talks to the FastAPI server over REST and one SSE stream; the server holds a Runner over the complete workflow, a render poller, a publisher and an avatar job; the workflow reaches Gemini, Memory Bank, RAG Engine and Veo; the container ships to Cloud Run.">
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {box(20, 40, 180, 150, "vibestudio/web", "the React page", CYAN)}
        <text x="36" y="96" fontSize="9" style={mono} fill="currentColor" opacity="0.7">idea · backlog · graph</text>
        <text x="36" y="112" fontSize="9" style={mono} fill="currentColor" opacity="0.7">events · stage · pick</text>
        <text x="36" y="128" fontSize="9" style={mono} fill="currentColor" opacity="0.7">player · thumbnail · publish</text>
        <text x="36" y="144" fontSize="9" style={mono} fill="currentColor" opacity="0.7">profile · avatar</text>
        <line x1="200" y1="100" x2="290" y2="100" stroke={CYAN} strokeWidth="1.4" markerEnd="url(#arch-arrow)" />
        <text x="245" y="92" textAnchor="middle" fontSize="8.5" style={mono} fill={CYAN}>SSE /api/events</text>
        <line x1="290" y1="140" x2="200" y2="140" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.2" markerEnd="url(#arch-arrow)" />
        <text x="245" y="156" textAnchor="middle" fontSize="8.5" style={mono} fill="currentColor" opacity="0.7">REST /api/*</text>
        {box(290, 40, 300, 150, "vibestudio/server", "FastAPI · one process", AMBER)}
        <rect x="306" y="86" width="268" height="26" rx="7" fill={tint(AMBER, 0.13)} stroke={AMBER} />
        <text x="440" y="103" textAnchor="middle" fontSize="9.5" style={mono} fill={AMBER}>Runner(app_name, agent=wf, session_service)</text>
        <text x="320" y="132" fontSize="9" style={mono} fill="currentColor" opacity="0.7">bus · render poller · publisher (3×)</text>
        <text x="320" y="148" fontSize="9" style={mono} fill="currentColor" opacity="0.7">avatar job · backlog / profile files</text>
        <text x="320" y="164" fontSize="9" style={mono} fill="currentColor" opacity="0.7">server/agent: the finished graph, byte for byte</text>
        <line x1="590" y1="100" x2="680" y2="100" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.2" markerEnd="url(#arch-arrow)" />
        <text x="635" y="92" textAnchor="middle" fontSize="8.5" style={mono} fill="currentColor" opacity="0.7">run_async</text>
        {box(680, 40, 200, 70, "Google Cloud", "Gemini · Memory Bank · RAG · Veo", PURPLE)}
        {box(680, 120, 200, 70, "Cloud Run", "one container, one URL", GREEN)}
        <path d="M440 190 L 440 210 L 780 210 L 780 190" fill="none" stroke={GREEN} strokeOpacity="0.8" strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#arch-arrow)" />
        <text x="610" y="224" textAnchor="middle" fontSize="8.5" style={mono} fill={GREEN}>deploy.py: gcloud run deploy --source vibestudio</text>
      </svg>
      <figcaption className="mt-2 text-xs text-fg-muted">The page never imports ADK or reads a file. The server owns the Runner, the poller, the publisher, and the files; the whole folder ships as one container.</figcaption>
    </figure>
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
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-hairline bg-input px-3 py-2 text-left font-mono text-xs text-fg hover:border-vibe-cyan/60"
      title="copy for a terminal"
    >
      <span className="truncate">{text}</span>
      <span className="shrink-0 text-[10px] text-fg-muted">{copied ? "copied" : "copy"}</span>
    </button>
  );
}

/** The deploy, run from here: `python vibestudio/deploy.py` as a worker on the
 *  lab server, its output streamed, the service URL at the end. */
function DeployRunner() {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<DeployStatus | null>(null);
  useRunEvents((verb, line) => {
    if (verb === "deploy") setLines((l) => [...l.slice(-299), line]);
  });
  const refresh = useCallback(() => api.deployStatus().then(setStatus).catch(() => {}), []);
  useEffect(() => {
    refresh().then(() => {});
    api.deployStatus().then((st) => {
      if (st.running) {
        setRunning(true);
        setLines(["a deploy is already running on this server; its remaining output appears here"]);
      }
    });
  }, [refresh]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      const st = await api.deployStatus();
      setStatus(st);
      if (!st.running) setRunning(false);
    }, 2000);
    return () => clearInterval(t);
  }, [running]);
  const run = async () => {
    setLines([]);
    const r = await api.deployRun();
    if (!r.ok) {
      setLines([`could not start: ${r.detail}`]);
      return;
    }
    setRunning(true);
  };
  const url = status?.url || "";
  const exit = status?.last_exit?.code ?? null;
  return (
    <section className="rounded-3xl border p-6" style={{ borderColor: tint(GREEN, 0.33), background: tint(GREEN, 0.04) }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: GREEN }}>
            Deploy
          </p>
          <h2 className="font-display mt-2 text-2xl">Ship it to Cloud Run.</h2>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            The button runs the command below on this server and streams its output. Cloud Build reads the Dockerfile, builds the page and the server into
            one image, and Cloud Run serves it. The first deploy takes a few minutes; later ones are faster.
            {status?.gcloud_project ? (
              <>
                {" "}
                Project: <code className="font-mono text-fg">{status.gcloud_project}</code>.
              </>
            ) : null}
          </p>
        </div>
        <button onClick={run} disabled={running} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.03] disabled:opacity-50" style={{ background: GREEN }}>
          {running ? <RefreshCw size={16} className="animate-spin" /> : <Rocket size={16} />}
          {running ? "Deploying…" : url ? "Deploy again" : "Deploy to Cloud Run"}
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">the command</p>
          <div className="mt-1">
            <CopyLine text="python vibestudio/deploy.py" />
          </div>
          <p className="mt-2 text-xs text-fg-muted">
            Reads the project and the switches from <code className="font-mono text-fg">.env</code>, the two resource names from{" "}
            <code className="font-mono text-fg">runs/memorybank.json</code> and <code className="font-mono text-fg">runs/ragcorpus.json</code>, and passes them as env vars. Nothing is copied by hand.
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">before you deploy</p>
          <ul className="mt-1 space-y-1 text-xs text-fg-muted">
            <li>{status?.app_built ? "✓" : "·"} the page is built ({status?.app_built ? "vibestudio/web/dist exists" : "run vibestudio/run.sh once, or let the Dockerfile build it"})</li>
            <li>· gcloud is logged in and the Cloud Run, Cloud Build and Artifact Registry APIs are on</li>
            <li>· the service account Cloud Run uses can call GEAP (roles/aiplatform.user)</li>
          </ul>
        </div>
      </div>
      {(lines.length > 0 || running) && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-hairline bg-input">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
            <span>python vibestudio/deploy.py · output</span>
            <span>{running ? "running…" : exit === 0 ? "done" : exit === null ? "" : `exit ${exit}`}</span>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">{lines.filter((l) => !/Warning|warn\(/.test(l)).join("\n") || "starting…"}</pre>
        </div>
      )}
      {url && !running && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between" style={{ borderColor: tint(GREEN, 0.4), background: tint(GREEN, 0.06) }}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: GREEN }}>
              live
            </p>
            <p className="mt-1 font-mono text-sm text-fg">{url}</p>
            <p className="mt-1 text-xs text-fg-muted">
              Head over there: type an idea, pick a direction, watch the render land, publish. It is the same workflow you built, driven by the Runner, on Cloud Run.
            </p>
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-black" style={{ background: GREEN }}>
            Open Vibe Studio <ExternalLink size={14} />
          </a>
        </motion.div>
      )}
      {exit !== null && exit !== 0 && !running && <p className="mt-3 font-mono text-xs" style={{ color: RED }}>the deploy exited with {exit}; the output above says why</p>}
    </section>
  );
}

export function Deploy() {
  return (
    <div className="space-y-12">
      <StepHeader
        kicker="Step 9 · Deploy"
        color={GREEN}
        title="The Runner, an app on top, Cloud Run."
        blurb="Every step so far ran the graph through adk web. The app in vibestudio/ runs it through the same class the dev UI uses, a Runner, with its own page in front and one event stream between them. Read how it is put together, run it here, then ship it."
      />

      <In delay={0.1}>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {RUNNER_POINTS.map((p, i) => (
            <motion.div key={p.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="rounded-3xl border border-hairline bg-card p-5">
              <p className="text-sm font-semibold" style={{ color: GREEN }}>
                {p.t}
              </p>
              <p className="mt-2 text-sm text-fg-muted">{p.d}</p>
            </motion.div>
          ))}
        </section>
      </In>

      <In delay={0.2}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">How it is put together</p>
          <h2 className="font-display mt-2 text-2xl">Two halves, one stream.</h2>
          <ArchFigure />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">vibestudio/server/runner.py · the Runner</div>
              <pre className="max-h-80 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
                <code>{CODE_RUNNER}</code>
              </pre>
            </div>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-input">
              <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">one event on the stream</div>
              <pre className="max-h-80 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
                <code>{CODE_EVENT}</code>
              </pre>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-fg-muted">
            The Runner drives the graph on a worker thread with its own event loop, so a slow node never stalls the server. Every ADK event is folded into one
            state object and published as one app event: node starts and ends, the gate opening with its candidates, the render receipt and every Veo check,
            the delivery, publishing. The page draws the graph from <code className="font-mono text-fg">GET /api/graph</code>, which reads{" "}
            <code className="font-mono text-fg">wf.graph</code>, so a change to the workflow changes the picture.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-hairline bg-input px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
            <pre className="m-0">{`vibestudio/
  server/main.py      FastAPI: the page, /api, /static      server/runner.py    the Runner, RunState, the render poller
  server/bus.py       the event bus, the SSE stream          server/publish.py   vibetube.dev, three attempts, then it asks
  server/api.py       the REST surface                       server/avatar.py    a portrait from your description
  server/files.py     backlog.txt, profile.json, thumbnails  server/graphinfo.py the drawing, from wf.graph
  server/agent/       the finished agent (checks/verify_app.py keeps it byte-equal to the solution)
  web/                the React page                         Dockerfile · deploy.py · run.sh`}</pre>
          </div>
        </section>
      </In>

      <In delay={0.3}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: CYAN }}>
            Run it here first
          </p>
          <h2 className="font-display mt-2 text-2xl">The app, on this machine.</h2>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            In <b>tab 1</b>, from the repo root. The first start builds the page; then the app is on port 4700. It shares this repo's{" "}
            <code className="font-mono text-fg">.env</code> and <code className="font-mono text-fg">runs/</code>, so the bank and the corpus from steps 6 and 7 are
            already connected.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <CopyLine text="vibestudio/run.sh" />
            <CopyLine text="http://localhost:4700" />
          </div>
          <p className="mt-3 text-xs text-fg-muted">
            Type an idea, or leave it empty. The graph you built runs left to right on the page; it stops for your pick, and later for the render. With{" "}
            <code className="font-mono text-fg">STUDIO_REAL_VIDEO=0</code> the render is a stand-in and there is no clip to play.
          </p>
        </section>
      </In>

      <In delay={0.4}>
        <DeployRunner />
      </In>

      <In delay={0.5}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">What Cloud Run is</p>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            A managed place to run a container: you hand it an image and a port, it gives you an HTTPS URL, scales instances up and down with traffic, and bills
            per request time. <code className="font-mono text-fg">gcloud run deploy --source</code> does the build too, from the Dockerfile in the folder. This app
            keeps a run's state in its process, so <code className="font-mono text-fg">deploy.py</code> asks for one instance kept warm and session affinity; a
            production version would keep that state in the session store and let instances come and go.
          </p>
        </section>
      </In>
    </div>
  );
}
