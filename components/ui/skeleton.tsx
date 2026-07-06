import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/10",
        className,
      )}
    />
  );
}
