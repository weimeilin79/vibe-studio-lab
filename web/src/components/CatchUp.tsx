import { useCallback, useEffect, useState } from "react";
import { FastForward, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { tint } from "../steps/colors";

/** The edits from earlier steps this page's run depends on. Shown only while
 *  one of them is still open; one click writes the answers into the files,
 *  the same text the earlier pages' hints show. */
const LABEL: Record<string, string> = {
  GATE_INPUT: "step 4d · the RequestInput in direction_gate",
  PERSIST_STATE: "step 5a · the state write in persist_direction",
  POLICY_ROUTE: "step 5b · the route in policy_check",
  VIDEO_TOOL: "step 8a · the LongRunningFunctionTool wrapper",
  DELIVER_RESPONSE: "step 8a · the FunctionResponse in agent/deliver.py",
};

export function CatchUp({ needs, color }: { needs: string[]; color: string }) {
  const [open, setOpen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string[] | null>(null);
  const check = useCallback(async () => {
    try {
      const st = await api.holes();
      setOpen(needs.filter((n) => st[n] === "open"));
    } catch {
      setOpen([]);
    }
  }, [needs]);
  useEffect(() => {
    check();
  }, [check]);
  if (open.length === 0 && !done) return null;
  const fill = async () => {
    setBusy(true);
    try {
      const r = await api.fillHoles(open);
      setDone(r.filled);
      await check();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-3xl border p-5" style={{ borderColor: tint(color, 0.4), background: tint(color, 0.05) }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color }}>
            Jumping in here
          </p>
          {open.length > 0 ? (
            <>
              <p className="mt-1 text-sm text-fg">This step's run needs edits from earlier parts that are still open:</p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-fg-muted">
                {open.map((n) => (
                  <li key={n}>
                    · {n} <span className="text-fg-muted/70">({LABEL[n]})</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-sm text-fg">Filled: {done?.join(", ")}. The earlier edits are in place; this step runs on its own.</p>
          )}
        </div>
        {open.length > 0 && (
          <button onClick={fill} disabled={busy} className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50" style={{ background: color }}>
            {busy ? <RefreshCw size={15} className="animate-spin" /> : <FastForward size={15} />}
            Fill them for me
          </button>
        )}
      </div>
    </section>
  );
}
