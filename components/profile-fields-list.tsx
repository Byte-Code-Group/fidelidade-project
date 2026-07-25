"use client";

import { useRef, useState, useTransition } from "react";
import { Reorder, useDragControls } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { ProfileFieldForm, FIELD_TYPE_LABELS } from "@/components/profile-field-form";
import type { ProfileField } from "@/lib/types";
import { traduzirErro } from "@/lib/error-messages";

interface ProfileFieldsListProps {
  fields: ProfileField[];
  createAction: (formData: FormData) => Promise<{ error?: string }>;
  updateAction: (fieldId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteAction: (fieldId: string) => Promise<{ error?: string }>;
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
  const [prevFields, setPrevFields] = useState(fields);

  // Sincroniza com o server component pai depois de create/update/delete
  // (o router.refresh implícito do server action traz `fields` atualizado).
  // Feito no corpo do render (não em effect) pra não disparar um render extra.
  if (fields !== prevFields) {
    setPrevFields(fields);
    setItems(fields);
  }

  async function persistOrder(next: ProfileField[]) {
    setItems(next);
    const { error } = await reorderAction(next.map((f) => f.id));
    if (error) toast.error(traduzirErro(error));
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

      <NewFieldForm createAction={createAction} />
    </div>
  );
}

function NewFieldForm({
  createAction,
}: {
  createAction: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <details className="group rounded-xl border border-dashed border-black/20 dark:border-white/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium">
        + Novo campo
        <Icon
          name="chevronRight"
          className="h-4 w-4 shrink-0 opacity-50 transition group-open:rotate-90"
        />
      </summary>
      <div className="space-y-3 border-t border-black/10 px-4 py-4 dark:border-white/10">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            startTransition(async () => {
              const { error } = await createAction(formData);
              if (error) toast.error(traduzirErro(error));
              else {
                toast.success("Campo criado.");
                form.reset();
              }
            });
          }}
        >
          <ProfileFieldForm />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Adicionando…" : "Adicionar campo"}
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}

function ProfileFieldRow({
  field: f,
  updateAction,
  deleteAction,
}: {
  field: ProfileField;
  updateAction: (fieldId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteAction: (fieldId: string) => Promise<{ error?: string }>;
}) {
  const controls = useDragControls();
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();
  const draggedRef = useRef(false);

  return (
    <Reorder.Item
      value={f}
      dragListener={false}
      dragControls={controls}
      className="rounded-xl border border-black/10 bg-[var(--background)] dark:border-white/10"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
      onDragStart={() => {
        draggedRef.current = true;
      }}
      onDragEnd={() => {
        // O click sintético do soltar o drag dispara logo em seguida;
        // limpa a flag depois pra não travar o próximo clique real.
        setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      }}
    >
      <details className="group">
        <summary
          className="flex cursor-pointer list-none items-center gap-3 px-4 py-3"
          onClick={(e) => {
            if (draggedRef.current) {
              e.preventDefault();
              draggedRef.current = false;
            }
          }}
        >
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
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              startTransition(async () => {
                const { error } = await updateAction(f.id, formData);
                if (error) toast.error(traduzirErro(error));
                else toast.success("Campo salvo.");
              });
            }}
          >
            <ProfileFieldForm field={f} />
            <div className="flex justify-end">
              <Button type="submit" className="px-3 py-1.5" disabled={pending}>
                {pending ? "Salvando…" : "Salvar campo"}
              </Button>
            </div>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startDeleteTransition(async () => {
                const { error } = await deleteAction(f.id);
                if (error) toast.error(traduzirErro(error));
              });
            }}
          >
            <button
              type="submit"
              disabled={deleting}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {deleting ? "Excluindo…" : "Excluir campo"}
            </button>
          </form>
        </div>
      </details>
    </Reorder.Item>
  );
}
