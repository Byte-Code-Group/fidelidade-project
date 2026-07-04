"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { ProfileFieldForm, FIELD_TYPE_LABELS } from "@/components/profile-field-form";
import type { ProfileField } from "@/lib/types";

interface ProfileFieldsListProps {
  fields: ProfileField[];
  createAction: (formData: FormData) => void;
  updateAction: (fieldId: string, formData: FormData) => void;
  deleteAction: (fieldId: string) => void;
  reorderAction: (orderedIds: string[]) => void;
}

// Lista reordenável por arrastar (handle ⠿) — a ordem exibida aqui É a ordem
// salva (display_order), sem input manual de número.
export function ProfileFieldsList({
  fields,
  createAction,
  updateAction,
  deleteAction,
  reorderAction,
}: ProfileFieldsListProps) {
  const [items, setItems] = useState(fields);
  const [dragId, setDragId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const next = [...items];
    const from = next.findIndex((f) => f.id === dragId);
    const to = next.findIndex((f) => f.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setDragId(null);
    reorderAction(next.map((f) => f.id));
  }

  return (
    <div className="space-y-2">
      {items.map((f) => (
        <details
          key={f.id}
          className="group rounded-xl border border-black/10 dark:border-white/10"
          draggable
          onDragStart={() => setDragId(f.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(f.id)}
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
            <Icon
              name="gripVertical"
              className="h-4 w-4 shrink-0 cursor-grab opacity-40 active:cursor-grabbing"
            />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-medium">{f.label}</span>
              <span className="shrink-0 text-xs opacity-50">
                {FIELD_TYPE_LABELS[f.field_type]}
                {f.required && " · obrigatório"}
              </span>
            </div>
            <Icon
              name="chevronRight"
              className="h-4 w-4 shrink-0 opacity-50 transition group-open:rotate-90"
            />
          </summary>
          <div className="space-y-3 border-t border-black/10 px-4 py-4 dark:border-white/10">
            <form action={updateAction.bind(null, f.id)} className="space-y-3">
              <ProfileFieldForm field={f} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar campo
                </Button>
              </div>
            </form>
            <form action={deleteAction.bind(null, f.id)}>
              <button type="submit" className="text-xs text-red-600 hover:underline">
                Excluir campo
              </button>
            </form>
          </div>
        </details>
      ))}

      <details className="group rounded-xl border border-dashed border-black/20 dark:border-white/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium">
          + Novo campo
          <Icon
            name="chevronRight"
            className="h-4 w-4 shrink-0 opacity-50 transition group-open:rotate-90"
          />
        </summary>
        <div className="space-y-3 border-t border-black/10 px-4 py-4 dark:border-white/10">
          <form action={createAction} className="space-y-3">
            <ProfileFieldForm />
            <div className="flex justify-end">
              <Button type="submit">Adicionar campo</Button>
            </div>
          </form>
        </div>
      </details>
    </div>
  );
}
