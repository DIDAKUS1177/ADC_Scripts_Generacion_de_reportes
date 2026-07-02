import type { ReactNode } from "react";

type Tone = "gray" | "red" | "yellow" | "green" | "blue";

const TONE_CLASSES: Record<Tone, string> = {
  gray: "bg-ink-100 text-ink-600",
  red: "bg-brand-100 text-brand-700",
  yellow: "bg-amber-100 text-amber-700",
  green: "bg-emerald-100 text-emerald-700",
  blue: "bg-sky-100 text-sky-700",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
