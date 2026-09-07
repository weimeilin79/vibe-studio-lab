/**
 * Wire types shared with the backend. The Python side of this contract is
 * server/schemas.py; keep the two in sync by hand (there is no codegen).
 */

export type StageStatus =
  | "idle"
  | "now"
  | "pass"
  | "fail"
  | "retry"
  | "degraded"
  | "blocked"
  | "skip"
  | "stall"
  | "wait";

export interface StageRow {
  key: string;
  label: string;
  sub: string;
  status: StageStatus;
  note: string;
}

export interface Candidate {
  title: string;
  angle: string;
  hook: string;
  evidence: { source: string; note?: string }[];
}

export interface GraphEdge {
  from: string;
  to: string;
  route: string | null;
}

export type NodeState = "idle" | "now" | "done" | "you";

export interface GraphView {
  edges: GraphEdge[];
  nodes: Record<string, NodeState>;
}

export interface WorkerExit {
  verb: string;
  code: number;
  at: number;
}

export interface RunSnapshot {
  run_id: string | null;
  lap: number | null;
  /** idle | proposal | form | scripted | blocked | published */
  phase: string;
  /** Verb of a worker currently running, or null. */
  busy: string | null;
  last_exit: WorkerExit | null;
  hint: string;
  suggested_idea: string;
  candidates: Candidate[];
  direction: string | null;
  thumb: { ref: string; generated: boolean; ready: boolean } | null;
  thumb_pending: boolean;
  published: { video_id: string; url: string } | null;
  blocked: { direction: string; hits: string[] } | null;
  room: Record<string, unknown> | null;
  stages: StageRow[];
  graph: GraphView;
  updated_at: number;
}

export type RunEvent =
  | { type: "snapshot"; data: RunSnapshot }
  | { type: "log"; verb: string; line: string; at: number }
  | { type: "worker"; event: "started" | "exited"; verb: string; code?: number; at: number };

export interface InspectorStatus {
  up: boolean;
  url: string;
  apps: string[];
}

/** Evidence for step 3, read from the stage0_prompt sessions in the store. */
export interface Stage0Status {
  tools_wired: string[];
  tools_complete: boolean;
  sessions: number;
  latest_session_id: string | null;
  tool_calls: Record<string, number>;
  called_trends: boolean;
  called_backcatalog: boolean;
  turns: number;
  last_reply: string;
}

/** Evidence for step 4b, from stage1_fanout/agent.py and its sessions. */
export interface Stage1Status {
  edges: string[][];
  edges_complete: boolean;
  join_defined: boolean;
  sessions: number;
  runs: number;
  nodes_ran: string[];
  readers_ran: boolean;
  joined: boolean;
  backcatalog_empty: boolean | null;
  bundle: string;
}

/** Evidence for steps 4c and 4d, from stage2_direction/agent.py and its sessions. */
export interface Stage2Status {
  edges: string[][];
  chain: string[];
  proposer_defined: boolean;
  proposer_wired: boolean;
  gate_wired: boolean;
  persist_wired: boolean;
  gate_has_request_input: boolean;
  proposer_mode: string;
  sessions: number;
  nodes_ran: string[];
  asked: number;
  answered: number;
  candidates: string[];
  proposed_titles: string[];
  direction: string | null;
  user_prefs: Record<string, unknown> | null;
  state_keys: string[];
}

/** Evidence for steps 5a and 5b, from stage3_router/agent.py and its sessions. */
export interface Stage3Status {
  edges: string[][];
  chain: string[];
  router_wired: boolean;
  routes_wired: boolean;
  reroute_wired: boolean;
  scripter_defined: boolean;
  policy_route_wired: boolean;
  quarantine_kind: string | null;
  sessions: number;
  nodes_ran: string[];
  routes: string[];
  ok_runs: number;
  block_runs: number;
  tool_calls: Record<string, number>;
  cleaned: { title: string; angle: string; hook: string } | null;
  blocked_message: string;
  script_title: string;
}
