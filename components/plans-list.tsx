"use client";

import { useRef, useState, useTransition } from "react";
import { Reorder, useDragControls } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { PlanFields } from "@/components/plan-fields";
import type { BusinessPlan } from "@/lib/types";

interface PlansListProps {
  plans: BusinessPlan[];
  createAction: (formData: FormData) => Promise<{ error?: string }>;
  updateAction: (planId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteAction: (planId: string) => Promise<{ error?: string }>;
  reorderAction: (orderedIds: string[]) => Promise<{ error?: string }>;
}

// Lista reordenável por arrastar (handle ⠿) — mesmo padrão das missões:
// a posição na lista É a ordem salva (display_order).
export function PlansList({
  plans,
  createAction,
  updateAction,
  deleteAction,
  reorderAction,
}: PlansListProps) {
  const [items, setItems] = useState(plans);
  const [prevPlans, setPrevPlans] = useState(plans);

  if (plans !== prevPlans) {
    setPrevPlans(plans);
    setItems(plans);
  }

  async function persistOrder(next: BusinessPlan[]) {
    setItems(next);
    const { error } = await reorderAction(next.map((p) => p.id));
    if (error) toast.error(error);
  }

  return (
    <div className="space-y-2">
      <Reorder.Group axis="y" values={items} onReorder={persistOrder} className="space-y-2">
        {items.map((p) => (
          <PlanRow key={p.id} plan={p} updateAction={updateAction} deleteAction={deleteAction} />
        ))}
      </Reorder.Group>

      <NewPlanForm createAction={createAction} />
    </div>
  );
}

function NewPlanForm({
  createAction,
}: {
  createAction: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <details className="group rounded-xl border border-dashed border-black/20 dark:border-white/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium">
        + Novo plano
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
                toast.success("Plano criado.");
                form.reset();
              }
            });
          }}
        >
          <PlanFields />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Adicionando…" : "Adicionar plano"}
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}

function PlanRow({
  plan: p,
  updateAction,
  deleteAction,
}: {
  plan: BusinessPlan;
  updateAction: (planId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteAction: (planId: string) => Promise<{ error?: string }>;
}) {
  const controls = useDragControls();
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();
  const draggedRef = useRef(false);

  return (
    <Reorder.Item
      value={p}
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
          <Icon name="receipt" className="h-5 w-5 shrink-0 opacity-60" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-medium">{p.name}</span>
            <span className="shrink-0 text-xs opacity-50">
              R$ {p.price_month.toFixed(2)}/mês{p.is_popular && " · popular"}
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
                const { error } = await updateAction(p.id, formData);
                if (error) toast.error(error);
                else toast.success("Plano salvo.");
              });
            }}
          >
            <PlanFields plan={p} />
            <div className="flex justify-end">
              <Button type="submit" className="px-3 py-1.5" disabled={pending}>
                {pending ? "Salvando…" : "Salvar plano"}
              </Button>
            </div>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startDeleteTransition(async () => {
                const { error } = await deleteAction(p.id);
                if (error) toast.error(error);
              });
            }}
          >
            <button
              type="submit"
              disabled={deleting}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {deleting ? "Excluindo…" : "Excluir plano"}
            </button>
          </form>
        </div>
      </details>
    </Reorder.Item>
  );
}
