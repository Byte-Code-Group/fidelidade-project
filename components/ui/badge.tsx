import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const tones = {
  neutral: "bg-surface-2 text-muted ring-line",
  primary: "bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/20",
  success: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-400",
} as const;

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone && cn("ring-1 ring-inset", tones[tone]),
        className,
      )}
      {...props}
    />
  );
}
