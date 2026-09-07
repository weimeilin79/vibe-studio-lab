import type { ReactNode } from "react";
import { StubScene } from "../components/shared";
import { COLORS } from "./colors";
import { Story } from "./Story";
import { Overview } from "./Overview";
import { SinglePrompt } from "./SinglePrompt";
import { FanOut } from "./FanOut";
import { PolicyGate } from "./PolicyGate";

export { COLORS };

export interface Step {
  slug: string;
  label: string;
  color: string;
  element: ReactNode;
  /** Text on the Next button leading out of this step. */
  nextLabel?: string;
  /** Sub-pages, each at /step/<slug>/<id>; shown as chips in the top bar. */
  parts?: { id: string; label: string }[];
}

/**
 * The workshop, in order. Each entry is a page at /step/<slug>. Numbering
 * matches the codelab: 1 story (introduction), 2 what you build (setup),
 * 3 a single prompt (3a ADK at a glance, 3b the agent, 3c tools), 4 the fan-out.
 */
export const STEPS: Step[] = [
  { slug: "story", label: "The story", color: COLORS.cyan, element: <Story />, nextLabel: "Enter the studio" },
  {
    slug: "overview",
    label: "What you build",
    color: COLORS.purple,
    element: <Overview />,
    nextLabel: "Start building",
  },
  {
    slug: "single-prompt",
    label: "A single prompt",
    color: COLORS.blue,
    element: <SinglePrompt />,
    parts: [
      { id: "a", label: "ADK at a glance" },
      { id: "b", label: "The single-prompt agent" },
      { id: "c", label: "Tools, edit, run" },
    ],
  },
  {
    slug: "fan-out",
    label: "Research fan-out",
    color: COLORS.amber,
    element: <FanOut />,
    parts: [
      { id: "a", label: "The ADK graph" },
      { id: "b", label: "Declare the fan-out" },
      { id: "c", label: "The agent node" },
      { id: "d", label: "Human in the loop" },
    ],
  },
  {
    slug: "policy-gate",
    label: "Policy gate",
    color: COLORS.red,
    element: <PolicyGate />,
    parts: [
      { id: "a", label: "The router node" },
      { id: "b", label: "Agent modes and the task node" },
    ],
  },
  {
    slug: "run-publish",
    label: "Approve and publish",
    color: COLORS.green,
    element: (
      <StubScene
        kicker="Step 6 · Long-running tools"
        title="Approve the thumbnail and publish"
        blurb="Pending receipts, resuming by call id, and the two-line join condition."
      />
    ),
  },
  {
    slug: "bigquery",
    label: "Audience graph",
    color: COLORS.blue,
    element: (
      <StubScene
        kicker="Step 7 · BigQuery"
        title="The audience graph in BigQuery"
        blurb="Declare a property graph over existing tables and connect read_graph with one edge."
      />
    ),
  },
  {
    slug: "session-state",
    label: "Session state",
    color: COLORS.cyan,
    element: (
      <StubScene
        kicker="Step 8 · State"
        title="Session state and the user: prefix"
        blurb="Restart the server, read a preference from a new session."
      />
    ),
  },
  {
    slug: "memory-bank",
    label: "Memory Bank",
    color: COLORS.purple,
    element: (
      <StubScene
        kicker="Step 9 · Memory"
        title="Memory Bank: connect, write, read"
        blurb="Create a bank, write distilled notes, and connect read_memory with one edge."
      />
    ),
  },
];
