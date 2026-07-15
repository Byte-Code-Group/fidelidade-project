"use client";

import { useState, type ReactNode } from "react";
import { Icon, type IconKey } from "@/components/icons";
import { cn } from "@/lib/utils";

interface TabDef {
  key: string;
  label: string;
  icon: IconKey;
}

// Abas internas da tela de Customização. O botão "Salvar" fica fora daqui,
// então o <form> precisa continuar existindo mesmo com as abas trocando —
// por isso os painéis dentro do form só ficam com `hidden` (removidos da
// tela mas ainda no DOM), nunca desmontados: senão o campo de uma aba que
// não está ativa no momento do submit não iria junto no FormData.
// "Campos do cadastro" fica FORA do form (tem forms próprios de add/editar
// e HTML não permite <form> aninhado), então é renderizado à parte.
export function CustomizationTabs({
  tabs,
  panels,
  formId,
  saveAction,
  formTabKeys,
}: {
  tabs: TabDef[];
  panels: Record<string, ReactNode>;
  formId: string;
  saveAction: (formData: FormData) => void;
  formTabKeys: string[];
}) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.03]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
              t.key === active
                ? "bg-[var(--background)] shadow-sm"
                : "opacity-60 hover:opacity-100",
            )}
          >
            <Icon name={t.icon} className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <form id={formId} action={saveAction} className="space-y-5">
        {formTabKeys.map((key) => (
          <div key={key} className={key === active ? "space-y-5" : "hidden"}>
            {panels[key]}
          </div>
        ))}
      </form>

      {tabs
        .filter((t) => !formTabKeys.includes(t.key))
        .map((t) => (
          <div key={t.key} className={t.key === active ? "space-y-5" : "hidden"}>
            {panels[t.key]}
          </div>
        ))}
    </div>
  );
}
