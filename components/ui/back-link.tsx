import Link from "next/link";
import { Icon } from "@/components/icons";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
    >
      <Icon name="chevronLeft" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      {children}
    </Link>
  );
}
