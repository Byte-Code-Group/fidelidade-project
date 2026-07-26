import { cn } from "@/lib/utils";
import type { ComponentPropsWithRef } from "react";

export function Textarea({
  className,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-[var(--primary)]",
        className,
      )}
      {...props}
    />
  );
}
