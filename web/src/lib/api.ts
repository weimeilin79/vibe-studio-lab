import { useEffect, useRef, useState } from "react";
import type { InspectorStatus, RunEvent, RunSnapshot, Stage0Status, Stage1Status, Stage2Status, Stage3Status, Stage4Status, Stage5Status, Stage6Status, MemoryBank, RagCorpus, DeployStatus } from "./types";

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
  labInspector: () => fetch("/api/lab/inspector").then((r) => r.json() as Promise<InspectorStatus>),
  labLoad: (app: string) => fetch(`/api/lab/load/${app}`).then((r) => r.json() as Promise<{ ok: boolean; edges?: number | null; tools?: number; error: string }>),
  labStage2Load: () => fetch("/api/lab/stage2/load").then((r) => r.json() as Promise<{ ok: boolean; edges?: number; error: string }>),
  labStage2: () => fetch("/api/lab/stage2").then((r) => r.json() as Promise<Stage2Status>),
  labStage3: () => fetch("/api/lab/stage3").then((r) => r.json() as Promise<Stage3Status>),
  labStage4: () => fetch("/api/lab/stage4").then((r) => r.json() as Promise<Stage4Status>),
  labStage4Load: () => fetch("/api/lab/stage4/load").then((r) => r.json() as Promise<{ ok: boolean; edges?: number; error: string }>),
  bankRun: (cmd: "connect" | "load" | "list" | "reset") => post(`/api/lab/bank/${cmd}`, {}),
  bankStatus: () => fetch("/api/lab/bank/status").then((r) => r.json() as Promise<{ running: boolean; last_exit: { code: number; at: number } | null }>),
  labMemory: () => fetch("/api/lab/memory").then((r) => r.json() as Promise<MemoryBank>),
  labStage5: () => fetch("/api/lab/stage5").then((r) => r.json() as Promise<Stage5Status>),
  labStage5Load: () => fetch("/api/lab/stage5/load").then((r) => r.json() as Promise<{ ok: boolean; edges?: number; error: string }>),
  ragRun: (cmd: "connect" | "load" | "list" | "reset" | "query", text?: string) => post(`/api/lab/rag/${cmd}`, text === undefined ? {} : { text }),
  ragStatus: () => fetch("/api/lab/rag/status").then((r) => r.json() as Promise<{ running: boolean; last_exit: { code: number; at: number } | null }>),
  labRag: () => fetch("/api/lab/rag").then((r) => r.json() as Promise<RagCorpus>),
  labStage6: () => fetch("/api/lab/stage6").then((r) => r.json() as Promise<Stage6Status>),
  labStage6Load: () => fetch("/api/lab/stage6/load").then((r) => r.json() as Promise<{ ok: boolean; edges?: number; error: string }>),
  videoRun: (cmd: "deliver" | "status") => post(`/api/lab/video/${cmd}`, {}),
  deployRun: () => post<{ ok: boolean; detail: string }>("/api/lab/deploy", {}),
  deployStatus: () => fetch("/api/lab/deploy/status").then((r) => r.json() as Promise<DeployStatus>),
  videoStatus: () => fetch("/api/lab/video/status").then((r) => r.json() as Promise<{ running: boolean; last_exit: { code: number; at: number } | null }>),
  labStage3Load: () => fetch("/api/lab/stage3/load").then((r) => r.json() as Promise<{ ok: boolean; edges?: number; error: string }>),
  labStage1: () => fetch("/api/lab/stage1").then((r) => r.json() as Promise<Stage1Status>),
  labStage0: () => fetch("/api/lab/stage0").then((r) => r.json() as Promise<Stage0Status>),
  holes: () => fetch("/api/lab/holes").then((r) => r.json() as Promise<Record<string, string>>),
  fillHoles: (names: string[]) => post<{ filled: string[] }>("/api/lab/holes/fill", { names }),
  quarantineSkeleton: () => post<{ ok: boolean; state: string; detail?: string }>("/api/lab/quarantine/skeleton"),
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
    const es = new EventSource("/api/lab/events");
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
