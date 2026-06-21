"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { DocumentCategory } from "@/lib/types";

interface DocumentItem {
  id: string;
  category: DocumentCategory;
  title: string;
  file_url: string;
  created_at: string;
}

const TABS: { key: DocumentCategory; label: string }[] = [
  { key: "documentos", label: "Documentos" },
  { key: "termos", label: "Termos" },
  { key: "receituarios", label: "Receituários" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DocumentTabs({ documents }: { documents: DocumentItem[] }) {
  const [tab, setTab] = useState<DocumentCategory>("documentos");

  const filtered = documents.filter((d) => d.category === tab);
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl border border-black/5 bg-black/[0.03] p-1 dark:bg-white/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition",
              tab === t.key
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "opacity-60 hover:opacity-100",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Icon name="document" className="h-6 w-6" />}
          title="Nenhum documento encontrado"
          description={`Nenhum arquivo em ${current.label} no momento.`}
        />
      ) : (
        <Card>
          <div className="divide-y divide-black/5">
            {filtered.map((doc) => (
              <a
                key={doc.id}
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-black/[0.02] dark:hover:bg-white/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Icon name="document" className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{doc.title}</p>
                  <p className="text-xs opacity-50">{fmtDate(doc.created_at)}</p>
                </div>
                <Icon name="arrowRight" className="h-4 w-4 shrink-0 opacity-40" />
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
