"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";

export interface DataListRow {
  id: string;
  title: string;
  subtitle?: string;
  note?: string;
  trailing?: string;
  href?: string;
  badge?: { label: string; className: string };
  // Texto (já em minúsculas) usado pela busca.
  search: string;
  // Chave usada pelo filtro (ex: status). Vazio = não filtrável.
  filter?: string;
}

interface DataListFilter {
  label: string;
  value: string; // "" = todos
}

interface DataListProps {
  rows: DataListRow[];
  emptyText: string;
  searchPlaceholder?: string;
  filters?: DataListFilter[];
  pageSize?: number;
}

export function DataList({
  rows,
  emptyText,
  searchPlaceholder = "Buscar...",
  filters,
  pageSize = 8,
}: DataListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter && r.filter !== filter) return false;
      if (q && !r.search.includes(q)) return false;
      return true;
    });
  }, [rows, query, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  // Busca/filtro voltam pra página 1.
  const onQuery = (v: string) => {
    setQuery(v);
    setPage(1);
  };
  const onFilter = (v: string) => {
    setFilter(v);
    setPage(1);
  };

  return (
    <div>
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-black/5 px-4 py-3 dark:border-white/5">
          <div className="relative min-w-0 flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40"
            />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-black/10 bg-transparent py-1.5 pl-8 pr-2 text-sm dark:border-white/10"
            />
          </div>
          {filters && filters.length > 0 && (
            <select
              value={filter}
              onChange={(e) => onFilter(e.target.value)}
              className="rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/10"
            >
              <option value="">Todos</option>
              {filters.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {pageRows.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm opacity-50">
          {filtered.length === 0 && (query || filter)
            ? "Nada encontrado para esse filtro."
            : emptyText}
        </p>
      ) : (
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {pageRows.map((r) => {
            const inner = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  {r.subtitle && <p className="text-xs opacity-60">{r.subtitle}</p>}
                  {r.note && <p className="mt-0.5 text-xs opacity-50">{r.note}</p>}
                </div>
                {r.trailing && (
                  <span className="text-sm font-medium tabular-nums opacity-70">
                    {r.trailing}
                  </span>
                )}
                {r.badge && <Badge className={r.badge.className}>{r.badge.label}</Badge>}
                {r.href && (
                  <Icon name="chevronRight" className="h-4 w-4 shrink-0 opacity-40" />
                )}
              </>
            );
            return r.href ? (
              <a
                key={r.id}
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-6 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                {inner}
              </a>
            ) : (
              <div key={r.id} className="flex items-center gap-3 px-6 py-3">
                {inner}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-black/5 px-4 py-2.5 text-sm dark:border-white/5">
          <span className="opacity-60">
            {start + 1}–{Math.min(start + pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-md px-2 py-1 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Icon name="chevronLeft" className="h-4 w-4" />
            </button>
            <span className="tabular-nums opacity-60">
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-md px-2 py-1 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Icon name="chevronRight" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
