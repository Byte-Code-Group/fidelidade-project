"use client";

import { useRef, useState, useTransition } from "react";
import { Reorder, useDragControls } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { DocumentTemplateFields } from "@/components/document-template-fields";
import type { DocumentTemplate } from "@/lib/types";

interface DocumentTemplatesListProps {
  templates: DocumentTemplate[];
  createAction: (formData: FormData) => Promise<{ error?: string }>;
  updateAction: (templateId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteAction: (templateId: string) => Promise<{ error?: string }>;
  reorderAction: (orderedIds: string[]) => Promise<{ error?: string }>;
}

// Lista reordenável por arrastar (handle ⠿) — mesmo padrão de missões/planos:
// a posição na lista É a ordem salva (display_order).
export function DocumentTemplatesList({
  templates,
  createAction,
  updateAction,
  deleteAction,
  reorderAction,
}: DocumentTemplatesListProps) {
  const [items, setItems] = useState(templates);
  const [prevTemplates, setPrevTemplates] = useState(templates);

  if (templates !== prevTemplates) {
    setPrevTemplates(templates);
    setItems(templates);
  }

  async function persistOrder(next: DocumentTemplate[]) {
    setItems(next);
    const { error } = await reorderAction(next.map((t) => t.id));
    if (error) toast.error(error);
  }

  return (
    <div className="space-y-2">
      <Reorder.Group axis="y" values={items} onReorder={persistOrder} className="space-y-2">
        {items.map((t) => (
          <TemplateRow key={t.id} template={t} updateAction={updateAction} deleteAction={deleteAction} />
        ))}
      </Reorder.Group>

      <NewTemplateForm createAction={createAction} />
    </div>
  );
}

function NewTemplateForm({
  createAction,
}: {
  createAction: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <details className="group rounded-xl border border-dashed border-black/20 dark:border-white/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium">
        + Novo modelo
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
              if (error) toast.error(error);
              else {
                toast.success("Modelo criado.");
                form.reset();
              }
            });
          }}
        >
          <DocumentTemplateFields />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Adicionando…" : "Adicionar modelo"}
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}

function TemplateRow({
  template: t,
  updateAction,
  deleteAction,
}: {
  template: DocumentTemplate;
  updateAction: (templateId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteAction: (templateId: string) => Promise<{ error?: string }>;
}) {
  const controls = useDragControls();
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();
  const draggedRef = useRef(false);

  return (
    <Reorder.Item
      value={t}
      dragListener={false}
      dragControls={controls}
      className="rounded-xl border border-black/10 bg-[var(--background)] dark:border-white/10"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
      onDragStart={() => {
        draggedRef.current = true;
      }}
      onDragEnd={() => {
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
          <Icon name="document" className="h-5 w-5 shrink-0 opacity-60" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-medium">{t.name}</span>
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
                const { error } = await updateAction(t.id, formData);
                if (error) toast.error(error);
                else toast.success("Modelo salvo.");
              });
            }}
          >
            <DocumentTemplateFields template={t} />
            <div className="flex justify-end">
              <Button type="submit" className="px-3 py-1.5" disabled={pending}>
                {pending ? "Salvando…" : "Salvar modelo"}
              </Button>
            </div>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startDeleteTransition(async () => {
                const { error } = await deleteAction(t.id);
                if (error) toast.error(error);
              });
            }}
          >
            <button
              type="submit"
              disabled={deleting}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {deleting ? "Excluindo…" : "Excluir modelo"}
            </button>
          </form>
        </div>
      </details>
    </Reorder.Item>
  );
}
