import { cn } from "@/lib/utils";

// Marca do produto: cartão de fidelidade (contorno) com o chip preenchido no
// canto inferior direito. Usa currentColor → escuro no modo claro e claro no
// modo escuro automaticamente (tema definido em app/layout.tsx).
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-6 w-6 shrink-0", className)}
      aria-hidden
    >
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M6.5 10h5.5" />
      <circle cx="16.8" cy="14.6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
