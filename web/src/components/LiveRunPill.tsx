import { useRunEvents } from "../lib/api";

/**
 * A small live indicator in the top bar: which stage the current run is at,
 * fed by the SSE stream. It proves the update path end to end and gives the
 * student a glance at the run from any step.
 */
export function LiveRunPill() {
  const { snapshot, connected } = useRunEvents();

  if (!snapshot) {
    return (
      <span className="hidden items-center gap-2 rounded-full border border-hairline px-3 py-1 font-mono text-[11px] text-fg-muted sm:inline-flex">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-vibe-green" : "bg-fg-muted/40"}`} />
        {connected ? "connecting" : "offline"}
      </span>
    );
  }

  const active = snapshot.stages.find((s) => s.status === "now" || s.status === "wait");
  const label = snapshot.run_id
    ? active
      ? active.label
      : snapshot.published
        ? "Published"
        : snapshot.phase
    : "No run yet";
  const waiting = active?.status === "wait";
  const dot = waiting
    ? "bg-vibe-amber"
    : snapshot.busy
      ? "bg-vibe-cyan animate-pulse"
      : snapshot.published
        ? "bg-vibe-green"
        : "bg-fg-muted/50";

  return (
    <span
      className="hidden items-center gap-2 rounded-full border border-hairline bg-card/60 px-3 py-1 font-mono text-[11px] text-fg-muted sm:inline-flex"
      title={snapshot.run_id ? `run ${snapshot.run_id} · phase ${snapshot.phase}` : "start a run from the studio steps"}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {snapshot.lap ? <span className="text-fg">Lap {snapshot.lap}</span> : null}
      <span>{label}</span>
      {waiting && <span className="text-vibe-amber">· your turn</span>}
    </span>
  );
}
