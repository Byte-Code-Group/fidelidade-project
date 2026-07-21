"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";

export interface ClientRow {
  id: string;
  name: string;
  email: string;
  code: string;
  points: number;
  status: string; // "" = sem carteirinha
  planId: string;
  createdAt: number; // epoch ms, pra ordenar
}

interface PlanOption {
  id: string;
  name: string;
}

interface ClientsBrowserProps {
  clients: ClientRow[];
  plans: PlanOption[];
}

const statusStyle: Record<string, string> = {
  active: "bg-green-500/10 text-green-600",
  expired: "bg-amber-500/10 text-amber-600",
  suspended: "bg-red-500/10 text-red-600",
  inactive: "bg-black/10 text-gray-500 dark:bg-white/10",
};

const PAGE_SIZE = 8;

type Sort = "recent" | "oldest" | "points_desc" | "points_asc" | "name";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Janela de páginas em torno da atual (ex: 1 … 4 5 [6] 7 8 … 12).
function pageWindow(current: number, total: number): number[] {
  const span = 5;
  let start = Math.max(1, current - Math.floor(span / 2));
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function ClientsBrowser({ clients, plans }: ClientsBrowserProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(1);

  const statuses = useMemo(
    () => Array.from(new Set(clients.map((c) => c.status).filter(Boolean))),
    [clients],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = clients.filter((c) => {
      if (status && c.status !== status) return false;
      if (plan && c.planId !== plan) return false;
      if (q) {
        const hay = `${c.name} ${c.email} ${c.code}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...rows];
    switch (sort) {
      case "recent":
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "oldest":
        sorted.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case "points_desc":
        sorted.sort((a, b) => b.points - a.points);
        break;
      case "points_asc":
        sorted.sort((a, b) => a.points - b.points);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        break;
    }
    return sorted;
  }, [clients, query, status, plan, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const reset = () => setPage(1);
  const selectClass =
    "rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/10";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-0 flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              reset();
            }}
            placeholder="Buscar por nome, e-mail ou código..."
            className="w-full rounded-lg border border-black/10 bg-transparent py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--primary)] dark:border-white/10"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            reset();
          }}
          className={selectClass}
        >
          <option value="">Todos os status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {plans.length > 0 && (
          <select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              reset();
            }}
            className={selectClass}
          >
            <option value="">Todos os planos</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className={selectClass}
        >
          <option value="recent">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
          <option value="points_desc">Mais pontos</option>
          <option value="points_asc">Menos pontos</option>
          <option value="name">Nome (A–Z)</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3 border-b border-black/5 px-5 py-2.5 text-xs uppercase tracking-wider opacity-50 dark:border-white/5">
          <span className="flex-1">Cliente</span>
          <span className="w-20 text-right">Pontos</span>
          <span className="w-24 text-center">Status</span>
          <span className="w-4" />
        </div>

        {pageRows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm opacity-50">
            Nenhum cliente encontrado.
          </p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {pageRows.map((c) => (
              <Link
                key={c.id}
                href={`/painel/clientes/${c.id}`}
                className="flex items-center gap-3 px-5 py-3 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-xs font-semibold text-[var(--primary)]">
                  {initials(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs opacity-60">
                    {c.email}
                    {c.code ? ` · ${c.code}` : ""}
                  </p>
                </div>
                <span className="w-20 text-right text-sm tabular-nums opacity-70">
                  {c.points} pts
                </span>
                <span className="flex w-24 justify-center">
                  <Badge className={statusStyle[c.status] ?? "bg-black/5 opacity-70"}>
                    {c.status || "sem carteirinha"}
                  </Badge>
                </span>
                <Icon name="chevronRight" className="h-4 w-4 shrink-0 opacity-40" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm opacity-60">
          {filtered.length === 0
            ? "Nenhum resultado"
            : `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} de ${filtered.length}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <PageBtn
              onClick={() => setPage(1)}
              disabled={currentPage <= 1}
              label="«"
            />
            <PageBtn
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              label="‹"
            />
            {pageWindow(currentPage, totalPages).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`min-w-9 rounded-md px-3 py-1.5 text-sm tabular-nums transition ${
                  n === currentPage
                    ? "bg-[var(--primary)] text-white"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {n}
              </button>
            ))}
            <PageBtn
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              label="›"
            />
            <PageBtn
              onClick={() => setPage(totalPages)}
              disabled={currentPage >= totalPages}
              label="»"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PageBtn({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-w-9 rounded-md px-3 py-1.5 text-sm transition disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10"
    >
      {label}
    </button>
  );
}
