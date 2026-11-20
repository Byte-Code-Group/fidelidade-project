import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--line)_50%,var(--surface-2)_100%)] bg-[length:200%_100%] [animation:shimmer_1.4s_linear_infinite]",
        className,
      )}
    />
  );
}
