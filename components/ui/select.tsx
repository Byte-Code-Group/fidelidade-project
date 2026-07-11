import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-black/10 dark:border-white/10 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--primary)] dark:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}
