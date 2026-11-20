import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted/70 hover:border-[color-mix(in_srgb,var(--line),var(--foreground)_15%)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/12",
        className,
      )}
      {...props}
    />
  );
}
