import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";

/**
 * The wrap-up at the end of a hands-on part: close the embedded dev UI,
 * stop driver subprocesses this server started, and stop any standalone
 * `adk web` / `adk api_server` the student launched from a terminal.
 */
export function StopAdk({ onClose, next }: { onClose: () => void; next: string }) {
  const [stopped, setStopped] = useState<{ drivers_stopped: string[]; adk_processes_stopped: string[] } | null>(null);
  return (
    <section className="rounded-3xl border border-hairline bg-card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Before you continue</p>
          <h2 className="font-display mt-2 text-2xl">Stop adk web.</h2>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            This closes the embedded dev UI, stops any driver process this server started, and stops any{" "}
            <code className="font-mono">adk web</code> or <code className="font-mono">adk api_server</code> you launched
            from a terminal. {next}
          </p>
        </div>
        <button
          onClick={async () => {
            onClose();
            setStopped(await api.stopAdk());
          }}
          className="flex items-center gap-2 rounded-xl border border-vibe-red/50 bg-vibe-red/10 px-5 py-2.5 text-sm font-bold text-vibe-red transition-colors hover:bg-vibe-red/20"
        >
          <X size={16} /> Stop adk web
        </button>
      </div>
      {stopped && (
        <div className="mt-4 rounded-2xl border border-hairline bg-overlay p-4 font-mono text-xs text-fg-muted">
          <div>drivers stopped: {stopped.drivers_stopped.length ? stopped.drivers_stopped.join(", ") : "none were running"}</div>
          <div className="mt-1">
            adk processes stopped: {stopped.adk_processes_stopped.length ? stopped.adk_processes_stopped.join(" · ") : "none outside this server"}
          </div>
          <div className="mt-1 text-vibe-green">The embedded dev UI is closed.</div>
        </div>
      )}
    </section>
  );
}
