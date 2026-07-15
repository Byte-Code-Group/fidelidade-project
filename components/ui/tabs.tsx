"use client";

import { useState, type ReactNode } from "react";
import { Icon, type IconKey } from "@/components/icons";
import { cn } from "@/lib/utils";

interface TabDef {
  key: string;
  label: string;
  icon: IconKey;
  count?: number;
  content: ReactNode;
}

export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.03]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
              t.key === current?.key
                ? "bg-[var(--background)] shadow-sm"
                : "opacity-60 hover:opacity-100",
            )}
          >
            <Icon name={t.icon} className="h-4 w-4" />
            {t.label}
            {typeof t.count === "number" && (
              <span className="text-xs opacity-50">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {current?.content}
    </div>
  );
}
