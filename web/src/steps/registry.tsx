import type { ReactNode } from "react";
import { COLORS } from "./colors";
import { Story } from "./Story";
import { Overview } from "./Overview";
import { SinglePrompt } from "./SinglePrompt";
import { FanOut } from "./FanOut";
import { PolicyGate } from "./PolicyGate";
import { Memory } from "./Memory";
import { Rag } from "./Rag";
import { Video } from "./Video";
import { Deploy } from "./Deploy";
import { Summary } from "./Summary";

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
      { id: "a", label: "State" },
      { id: "b", label: "The router node" },
      { id: "c", label: "Agent modes and the task node" },
    ],
  },
  {
    slug: "memory",
    label: "Memory Bank",
    color: COLORS.purple,
    element: <Memory />,
    parts: [
      { id: "a", label: "Memory Bank" },
      { id: "b", label: "Callbacks" },
    ],
  },
  {
    slug: "rag",
    label: "RAG Engine",
    color: COLORS.cyan,
    element: <Rag />,
    parts: [
      { id: "a", label: "RAG Engine" },
      { id: "b", label: "The third reader" },
    ],
  },
  {
    slug: "video",
    label: "The video",
    color: COLORS.amber,
    element: <Video />,
    parts: [
      { id: "a", label: "A long-running tool" },
      { id: "b", label: "render_desk in the graph" },
    ],
  },
  {
    slug: "deploy",
    label: "Deploy",
    color: COLORS.green,
    element: <Deploy />,
  },
  {
    slug: "summary",
    label: "Summary",
    color: COLORS.purple,
    element: <Summary />,
  },
];
