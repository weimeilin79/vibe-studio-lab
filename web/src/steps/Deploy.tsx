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


const CODE_GCLOUD = `gcloud run deploy vibestudio --source vibestudio \\
  --project $GOOGLE_CLOUD_PROJECT --region us-central1 \\
  --labels dev-tutorial-codelab=vibetube --allow-unauthenticated \\
  --memory 2Gi --cpu 2 --timeout 3600 --concurrency 40 \\
  --max-instances 1 --min-instances 1 --session-affinity \\
  --set-env-vars GOOGLE_CLOUD_PROJECT=…,STUDIO_VERTEX=1,STUDIO_MEMORY_BANK=…,STUDIO_RAG_CORPUS=…,VIBETUBE_URL=…,VIBETUBE_EVENT=…,VIBETUBE_NAME=…,VIBETUBE_PROJECT=…`;

const CODE_RUNNER = `# vibestudio/server/runner.py
self._svc = DatabaseSessionService(db_url=config.DB_URL)
self._runner = Runner(app_name=config.APP, agent=wf, session_service=self._svc)

async for ev in self._runner.run_async(user_id=config.USER, session_id=run_id, new_message=message):
    self._absorb(ev)    # fold the ADK event into the run state, publish one app event

# the gate's answer and the render's delivery are the same call, with a function_response part
part = Part(function_response=FunctionResponse(id=call_id, name=name, response=response))`;


function ArchFigure() {
  const box = (x: number, y: number, w: number, h: number, label: string, sub: string, color: string, dashed = false) => (
    <g key={label}>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={tint(color, 0.06)} stroke={color} strokeOpacity="0.75" strokeDasharray={dashed ? "6 4" : undefined} />
      <text x={x + 14} y={y + 20} fontSize="11" style={mono} fill={color}>{label}</text>
      <text x={x + 14} y={y + 35} fontSize="8.5" style={mono} fill="currentColor" opacity="0.65">{sub}</text>
    </g>
  );
  return (
    <figure className="m-0 mt-4">
      <svg viewBox="0 0 940 320" className="h-auto w-full text-fg" role="img" aria-label="Google Cloud holds everything. Inside it, one Cloud Run service runs the whole app: vibestudio/web, the React page, and vibestudio/server, the FastAPI process with the Runner over the finished workflow. The page and the server talk over REST and one SSE stream. The server's run_async calls reach GEAP: Gemini, Memory Bank, RAG Engine and Veo. Your browser opens the service URL from outside. deploy.py ships the folder with gcloud run deploy.">
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {/* the viewer, outside */}
        <rect x="14" y="120" width="110" height="60" rx="10" fill="var(--overlay)" stroke="var(--hairline)" />
        <text x="69" y="145" textAnchor="middle" fontSize="10" style={mono} fill="currentColor">your browser</text>
        <text x="69" y="161" textAnchor="middle" fontSize="8" style={mono} fill="currentColor" opacity="0.6">the service URL</text>
        <line x1="124" y1="150" x2="176" y2="150" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.2" markerEnd="url(#arch-arrow)" />
        <text x="150" y="142" textAnchor="middle" fontSize="7.5" style={mono} fill="currentColor" opacity="0.7">https</text>

        {/* Google Cloud: the ground */}
        {box(160, 14, 766, 292, "Google Cloud", "project pokedemo-test", GREEN)}

        {/* Cloud Run: the whole app in one service */}
        {box(178, 58, 480, 226, "Cloud Run", "one container, one URL · vibestudio/", GREEN, true)}
        {box(194, 106, 176, 160, "vibestudio/web", "the React page", CYAN)}
        <text x="208" y="162" fontSize="8.5" style={mono} fill="currentColor" opacity="0.7">idea · backlog · graph</text>
        <text x="208" y="177" fontSize="8.5" style={mono} fill="currentColor" opacity="0.7">events · stage · pick</text>
        <text x="208" y="192" fontSize="8.5" style={mono} fill="currentColor" opacity="0.7">player · thumbnail · publish</text>
        <text x="208" y="207" fontSize="8.5" style={mono} fill="currentColor" opacity="0.7">profile · avatar · history</text>
        <line x1="370" y1="160" x2="452" y2="160" stroke={CYAN} strokeWidth="1.3" markerEnd="url(#arch-arrow)" />
        <text x="411" y="152" textAnchor="middle" fontSize="8" style={mono} fill={CYAN}>SSE /api/events</text>
        <line x1="452" y1="200" x2="370" y2="200" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.2" markerEnd="url(#arch-arrow)" />
        <text x="411" y="216" textAnchor="middle" fontSize="8" style={mono} fill="currentColor" opacity="0.7">REST /api/*</text>
        {box(454, 106, 190, 160, "vibestudio/server", "FastAPI · one process", AMBER)}
        <rect x="466" y="150" width="166" height="24" rx="7" fill={tint(AMBER, 0.14)} stroke={AMBER} />
        <text x="549" y="166" textAnchor="middle" fontSize="8.5" style={mono} fill={AMBER}>Runner(agent=wf)</text>
        <text x="468" y="194" fontSize="8" style={mono} fill="currentColor" opacity="0.7">platform: bus · files · publish</text>
        <text x="468" y="208" fontSize="8" style={mono} fill="currentColor" opacity="0.7">avatar · telemetry · graphinfo</text>
        <text x="468" y="222" fontSize="8" style={mono} fill="currentColor" opacity="0.7">agent/: the finished graph</text>
        <text x="468" y="236" fontSize="8" style={mono} fill="currentColor" opacity="0.7">the render poller answers the call</text>

        {/* GEAP */}
        <line x1="644" y1="162" x2="716" y2="162" stroke={PURPLE} strokeWidth="1.3" markerEnd="url(#arch-arrow)" />
        <text x="680" y="154" textAnchor="middle" fontSize="8" style={mono} fill={PURPLE}>run_async</text>
        {box(718, 106, 190, 160, "GEAP", "the services the graph calls", PURPLE)}
        <text x="732" y="162" fontSize="9" style={mono} fill="currentColor" opacity="0.85">Gemini · the agent nodes</text>
        <text x="732" y="180" fontSize="9" style={mono} fill="currentColor" opacity="0.85">Memory Bank · the callbacks</text>
        <text x="732" y="198" fontSize="9" style={mono} fill="currentColor" opacity="0.85">RAG Engine · read_feedback</text>
        <text x="732" y="216" fontSize="9" style={mono} fill="currentColor" opacity="0.85">Veo · render_desk</text>
        <text x="732" y="240" fontSize="8" style={mono} fill="currentColor" opacity="0.6">Cloud Trace · the spans</text>

        {/* the deploy */}
        <text x="418" y="298" textAnchor="middle" fontSize="8.5" style={mono} fill={GREEN}>gcloud run deploy --source vibestudio · the folder becomes the container</text>
      </svg>
      <figcaption className="mt-2 text-xs text-fg-muted">
        The page never imports ADK or reads a file. The server owns the Runner, the poller, the publisher and the files, and every model, memory, retrieval and render call leaves the container for GEAP in the same project.
      </figcaption>
    </figure>
  );
}

/** The deploy, run from here: the gcloud command (wrapped by vibestudio/deploy.py,
 *  which fills in the env values) as a worker on the lab server, its output
 *  streamed, the service URL at the end. */
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
            The button runs the gcloud command below from this server and streams its output. Cloud Build reads the Dockerfile, builds the page and the server
            into one image, and Cloud Run serves it. The first deploy takes a few minutes; later ones are faster.
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
          <pre className="mt-1 overflow-x-auto rounded-lg border border-hairline bg-input px-3 py-2 font-mono text-[11px] leading-relaxed text-fg">{CODE_GCLOUD}</pre>
          <p className="mt-2 text-xs text-fg-muted">
            One instance kept warm with session affinity, because a run's state lives in the process. The env values come from{" "}
            <code className="font-mono text-fg">.env</code> and from <code className="font-mono text-fg">runs/memorybank.json</code> and{" "}
            <code className="font-mono text-fg">runs/ragcorpus.json</code>; the button fills them in and runs this command.
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
            <span>gcloud run deploy · output</span>
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

      <In delay={0.2}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">How it is put together</p>
          <h2 className="font-display mt-2 text-2xl">The app on Cloud Run, the graph's services on GEAP.</h2>
          <ArchFigure />
          <div className="mt-4 max-w-3xl overflow-hidden rounded-2xl border border-hairline bg-input">
            <div className="border-b border-hairline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">vibestudio/server/runner.py · the Runner</div>
            <pre className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
              <code>{CODE_RUNNER}</code>
            </pre>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-fg-muted">
            The Runner drives the graph on a worker thread with its own event loop, so a slow node never stalls the server. Every ADK event is folded into one
            state object and published as one app event: node starts and ends, the gate opening with its candidates, the render receipt and every Veo check,
            the delivery, publishing. The page draws the graph from <code className="font-mono text-fg">GET /api/graph</code>, which reads{" "}
            <code className="font-mono text-fg">wf.graph</code>, so a change to the workflow changes the picture.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-hairline bg-input px-4 py-3 font-mono text-[11px] leading-relaxed text-fg">
            <pre className="m-0">{`vibestudio/
  server/
    main.py                 FastAPI: the page, /api, /static
    api.py                  the REST surface: run, pick, publish, backlog, profile, history
    runner.py               the Runner over the finished workflow, the render poller
    platform/               bus (the SSE stream), files, publish, avatar, telemetry, graphinfo
    agent/                  the finished agent, byte-equal to the lab's agent/ (checks/verify_app.py)
      graph.py              the workflow: direction_gate (4d), persist_direction (5a), policy_check (5b),
                            quarantine and the edge list (5c), read_feedback (7b), store_video (8b)
      desk.py               render_desk and render_submit, the LongRunningFunctionTool (8a)
      schemas.py            Directions, CleanedDirection, Script (4c, 5b, 5c)
      cleanup_tools.py      find_policy_hits, suggest_replacement (5c)
      trends.py · backlog.txt · comments.md · policy_words.txt · policy_replacements.txt
      platform/
        memory.py           recall_taste, remember_pick, Memory Bank (6)
        rag.py              retrieve, RAG Engine (7)
        videogen.py         start, check, Veo (8)
        state.py · config.py
  web/                      the React page
  Dockerfile · deploy.py · run.sh

The stage apps of steps 3 to 8 (stage0_prompt … stage6_video) each wired a subset of this graph.
The app skips them and runs wf from agent/graph.py, the complete workflow. The delivery console
of step 8 is not needed here: runner.py polls Veo and answers the pending call itself.`}</pre>
          </div>
        </section>
      </In>

      <In delay={0.3}>
        <section className="rounded-3xl border border-hairline bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">What Cloud Run is</p>
          <p className="mt-2 max-w-3xl text-sm text-fg-muted">
            Cloud Run is a serverless service for hosting your application and your agents. It scales instances up and down with traffic, and bills per
            request time. You can deploy with one <code className="font-mono text-fg">gcloud</code> command; here that command is embedded in a process behind
            the button below. This app keeps a run's state in its process, so the deploy asks for
            one instance kept warm and session affinity; a production version would keep that state in the session store and let instances come and go.
          </p>
        </section>
      </In>

      <In delay={0.4}>
        <DeployRunner />
      </In>

    </div>
  );
}
