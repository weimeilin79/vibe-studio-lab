import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { COLORS, tint } from "../steps/colors";

/** Before a run: import the app the way adk web will, in a fresh interpreter,
 *  and say whether it loads or what ADK objects to. Saved edits reach adk web
 *  through its reloader; this makes sure they did. */
export function LoadCheck({ app, intro }: { app: string; intro?: string }) {
  const [load, setLoad] = useState<{ ok: boolean; edges?: number | null; tools?: number; error: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      setLoad(await api.labLoad(app));
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="rounded-3xl border border-hairline bg-card p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Before you run</p>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{intro ?? `Save your edits, then click the button. It loads ${app} the way adk web will and tells you either that it loads or what ADK objects to.`}</p>
        </div>
        <button onClick={run} className="flex items-center gap-2 rounded-xl border border-hairline bg-overlay px-4 py-2 font-mono text-xs text-fg-muted hover:text-fg">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Check the workflow loads
        </button>
      </div>
      {load && (
        <div className="mt-3 rounded-xl border p-3 font-mono text-[11.5px]" style={load.ok ? { borderColor: tint(COLORS.green, 0.4), color: COLORS.green, background: tint(COLORS.green, 0.06) } : { borderColor: tint(COLORS.red, 0.4), color: COLORS.red, background: tint(COLORS.red, 0.06) }}>
          {load.ok ? (load.edges == null ? `loads · an agent with ${load.tools ?? 0} tool${load.tools === 1 ? "" : "s"}` : `loads · ${load.edges} edges`) : load.error}
        </div>
      )}
    </section>
  );
}
