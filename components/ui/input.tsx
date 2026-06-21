import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--primary)]",
        className,
      )}
      {...props}
    />
  );
}
