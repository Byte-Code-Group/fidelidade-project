"use client";

import { useId, useState, type ReactNode } from "react";
import { motion } from "motion/react";
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
  const pill = useId();

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === current?.key}
            onClick={() => setActive(t.key)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              t.key === current?.key ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {t.key === current?.key && (
              <motion.span
                layoutId={pill}
                className="absolute inset-0 rounded-lg bg-surface shadow-[0_1px_3px_rgb(16_24_40/0.1)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <Icon name={t.icon} className="relative h-4 w-4" />
            <span className="relative">{t.label}</span>
            {typeof t.count === "number" && (
              <span className="relative rounded-full bg-black/5 px-1.5 text-[11px] tabular-nums dark:bg-white/10">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {current?.content}
    </div>
  );
}
