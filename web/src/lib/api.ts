import { useEffect, useRef, useState } from "react";
import type { InspectorStatus, RunEvent, RunSnapshot, Stage0Status, Stage1Status, Stage2Status, Stage3Status } from "./types";

/**
 * The only place the frontend talks to the backend. Everything goes through
 * /api (JSON) or /api/run/events (SSE); the frontend never reads files or
 * calls ADK directly.
 */

async function post<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  getRun: () => fetch("/api/run").then((r) => r.json() as Promise<RunSnapshot>),
  startRun: (idea: string) => post("/api/run/start", { idea }),
  answer: (pick: string) => post("/api/run/answer", { pick }),
  approve: () => post("/api/run/approve"),
  regenerate: () => post("/api/run/regenerate"),
  finish: () => post("/api/run/finish"),
  learn: () => post("/api/run/learn"),
  connectBank: () => post("/api/run/bank"),
  buildGraph: () => post("/api/run/graph"),
  stop: () => post("/api/run/stop"),
  reset: () => post("/api/run/reset"),
  labInspector: () => fetch("/api/lab/inspector").then((r) => r.json() as Promise<InspectorStatus>),
  stopAdk: () => post<{ drivers_stopped: string[]; adk_processes_stopped: string[] }>("/api/lab/stop-adk"),
  labStage2Load: () => fetch("/api/lab/stage2/load").then((r) => r.json() as Promise<{ ok: boolean; edges?: number; error: string }>),
  labStage2: () => fetch("/api/lab/stage2").then((r) => r.json() as Promise<Stage2Status>),
  labStage3: () => fetch("/api/lab/stage3").then((r) => r.json() as Promise<Stage3Status>),
  labStage3Load: () => fetch("/api/lab/stage3/load").then((r) => r.json() as Promise<{ ok: boolean; edges?: number; error: string }>),
  labStage1: () => fetch("/api/lab/stage1").then((r) => r.json() as Promise<Stage1Status>),
  labStage0: () => fetch("/api/lab/stage0").then((r) => r.json() as Promise<Stage0Status>),
  getCode: (path: string) => fetch(`/api/code?path=${encodeURIComponent(path)}`).then((r) => r.json()),
  putCode: (path: string, content: string) => post("/api/code", { path, content }),
};

/**
 * Live run state over Server-Sent Events. The server pushes a full snapshot
 * whenever anything under runs/ changes, plus worker log lines. The browser's
 * EventSource reconnects on its own if the connection drops.
 */
export function useRunEvents(onLog?: (verb: string, line: string) => void) {
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  useEffect(() => {
    const es = new EventSource("/api/run/events");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      const evt = JSON.parse(m.data) as RunEvent;
      if (evt.type === "snapshot") setSnapshot(evt.data);
      else if (evt.type === "log") onLogRef.current?.(evt.verb, evt.line);
    };
    return () => es.close();
  }, []);

  return { snapshot, connected };
}
