"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  baseUrl,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const getUrl = (page: number) =>
    page === 1 ? baseUrl : `${baseUrl}?page=${page}`;

  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      <Link
        href={getUrl(Math.max(1, currentPage - 1))}
        className={cn(
          "rounded px-2 py-1 text-sm",
          currentPage === 1
            ? "cursor-not-allowed opacity-50"
            : "hover:bg-black/5 dark:hover:bg-white/10",
        )}
        onClick={(e) => currentPage === 1 && e.preventDefault()}
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
      </Link>

      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`dots-${i}`} className="px-2 py-1 text-sm opacity-50">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={getUrl(page)}
            className={cn(
              "rounded px-2.5 py-1 text-sm font-medium transition",
              currentPage === page
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "hover:bg-black/5 dark:hover:bg-white/10",
            )}
          >
            {page}
          </Link>
        ),
      )}

      <Link
        href={getUrl(Math.min(totalPages, currentPage + 1))}
        className={cn(
          "rounded px-2 py-1 text-sm",
          currentPage === totalPages
            ? "cursor-not-allowed opacity-50"
            : "hover:bg-black/5 dark:hover:bg-white/10",
        )}
        onClick={(e) => currentPage === totalPages && e.preventDefault()}
      >
        <Icon name="chevronRight" className="h-4 w-4" />
      </Link>
    </div>
  );
}
