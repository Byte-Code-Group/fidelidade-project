"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { ProfileFieldForm, FIELD_TYPE_LABELS } from "@/components/profile-field-form";
import type { ProfileField } from "@/lib/types";

interface ProfileFieldsListProps {
  fields: ProfileField[];
  createAction: (formData: FormData) => void;
  updateAction: (fieldId: string, formData: FormData) => void;
  deleteAction: (fieldId: string) => void;
  reorderAction: (orderedIds: string[]) => Promise<{ error?: string }>;
}

// Lista reordenável por arrastar (handle ⠿), com animação fluida via
// Reorder do motion — a posição na lista É a ordem salva (display_order).
export function ProfileFieldsList({
  fields,
  createAction,
  updateAction,
  deleteAction,
  reorderAction,
}: ProfileFieldsListProps) {
  const [items, setItems] = useState(fields);

  async function persistOrder(next: ProfileField[]) {
    setItems(next);
    const { error } = await reorderAction(next.map((f) => f.id));
    if (error) toast.error(error);
  }

  return (
    <div className="space-y-2">
      <Reorder.Group axis="y" values={items} onReorder={persistOrder} className="space-y-2">
        {items.map((f) => (
          <ProfileFieldRow
            key={f.id}
            field={f}
            updateAction={updateAction}
            deleteAction={deleteAction}
          />
        ))}
      </Reorder.Group>

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

function ProfileFieldRow({
  field: f,
  updateAction,
  deleteAction,
}: {
  field: ProfileField;
  updateAction: (fieldId: string, formData: FormData) => void;
  deleteAction: (fieldId: string) => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={f}
      dragListener={false}
      dragControls={controls}
      className="rounded-xl border border-black/10 bg-[var(--background)] dark:border-white/10"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
    >
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
          <span
            onPointerDown={(e) => controls.start(e)}
            className="cursor-grab touch-none opacity-40 active:cursor-grabbing"
          >
            <Icon name="gripVertical" className="h-4 w-4 shrink-0" />
          </span>
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
    </Reorder.Item>
  );
}
