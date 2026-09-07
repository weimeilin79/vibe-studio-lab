import { motion } from "framer-motion";
import { BookOpen, Clapperboard, ListChecks, Sparkles, Timer, Workflow } from "lucide-react";
import { In, StepHeader } from "../components/shared";
import { COLORS } from "./colors";

const CHORES = [
  "research what is trending",
  "comb through the backlog of ideas",
  "choose a direction",
  "check it against the channel's policy",
  "write the script",
  "render the clip",
];

const WANTS = [
  { icon: Workflow, text: "Runs the routine steps on its own, in a fixed order." },
  { icon: ListChecks, text: "Asks you only for the decisions that need your judgment." },
  { icon: Sparkles, text: "Refuses a bad direction before it costs money." },
  { icon: Clapperboard, text: "Remembers what you picked last time, and reads what the audience said." },
  { icon: Timer, text: "Waits minutes for a render without a process kept alive for it." },
  { icon: BookOpen, text: "Leaves a record of every run: what was cited, what was refused, what shipped." },
];

export function Story() {
  return (
    <div className="space-y-12">
      <StepHeader
        kicker="Step 1 · The story"
        color={COLORS.cyan}
        title="You run a channel on VibeTube."
        blurb="You have a backlog of video ideas, an audience that leaves comments, and no time for the production work each video requires."
      />

      {/* The work, as a wall of chores */}
      <In delay={0.15}>
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-[1.1fr_1fr]">
          <div className="rounded-3xl border border-hairline bg-card p-6 shadow-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Every video, every week</p>
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {CHORES.map((c, i) => (
                <motion.li
                  key={c}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  className="flex items-center gap-2 rounded-xl border border-hairline bg-overlay px-3 py-2 text-sm"
                >
                  <span className="font-mono text-[10px] text-fg-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span>{c}</span>
                </motion.li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-fg-muted">
              A model can do each of these: Gemini researches and writes, Veo renders. That is not the hard part.
            </p>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-vibe-cyan/30 bg-vibe-cyan/5 p-6 shadow-2xl">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-vibe-cyan">The remaining problem</p>
              <h2 className="font-display mt-3 text-2xl leading-tight md:text-3xl">Process, not capability.</h2>
              <p className="mt-3 text-sm text-fg-muted">You want a pipeline that:</p>
            </div>
            <ul className="mt-4 space-y-3">
              {WANTS.map(({ icon: Icon, text }, i) => (
                <motion.li
                  key={text}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="flex items-start gap-3 text-sm"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-vibe-cyan/15 text-vibe-cyan">
                    <Icon size={15} />
                  </span>
                  <span>{text}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </In>

      <In delay={0.9}>
        <div className="mx-auto max-w-3xl rounded-2xl border border-hairline bg-card/60 px-6 py-5 text-center">
          <p className="text-balance text-base text-fg-muted md:text-lg">
            A pipeline with those properties is <span className="font-semibold text-fg">repeatable</span> and{" "}
            <span className="font-semibold text-fg">auditable</span>, and you could hand it to another creator. That is what you build
            in this lab, one node at a time, as an ADK <span className="font-mono text-fg">Workflow</span>. In the last step it becomes an
            app, <span className="font-display text-fg">Vibe Studio</span>, and ships to Cloud Run.
          </p>
        </div>
      </In>
    </div>
  );
}
