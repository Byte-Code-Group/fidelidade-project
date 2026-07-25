"use client";

import { useRef, useState, useTransition } from "react";
import { Reorder, useDragControls } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { MissionFields, MissionTypeIcon } from "@/components/mission-fields";
import type { Mission } from "@/lib/types";
import { traduzirErro } from "@/lib/error-messages";

interface MissionsListProps {
  missions: Mission[];
  createAction: (formData: FormData) => Promise<{ error?: string }>;
  updateAction: (missionId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteAction: (missionId: string) => Promise<{ error?: string }>;
  reorderAction: (orderedIds: string[]) => Promise<{ error?: string }>;
}

// Lista reordenável por arrastar (handle ⠿) — mesmo padrão dos campos do
// cadastro: a posição na lista É a ordem salva (display_order).
export function MissionsList({
  missions,
  createAction,
  updateAction,
  deleteAction,
  reorderAction,
}: MissionsListProps) {
  const [items, setItems] = useState(missions);
  const [prevMissions, setPrevMissions] = useState(missions);

  if (missions !== prevMissions) {
    setPrevMissions(missions);
    setItems(missions);
  }

  async function persistOrder(next: Mission[]) {
    setItems(next);
    const { error } = await reorderAction(next.map((m) => m.id));
    if (error) toast.error(traduzirErro(error));
  }

  return (
    <div className="space-y-2">
      <Reorder.Group axis="y" values={items} onReorder={persistOrder} className="space-y-2">
        {items.map((m) => (
          <MissionRow key={m.id} mission={m} updateAction={updateAction} deleteAction={deleteAction} />
        ))}
      </Reorder.Group>

      <NewMissionForm createAction={createAction} />
    </div>
  );
}

function NewMissionForm({
  createAction,
}: {
  createAction: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <details className="group rounded-xl border border-dashed border-black/20 dark:border-white/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium">
        + Nova missão
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
                toast.success("Missão criada.");
                form.reset();
              }
            });
          }}
        >
          <MissionFields />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Adicionando…" : "Adicionar missão"}
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}

function MissionRow({
  mission: m,
  updateAction,
  deleteAction,
}: {
  mission: Mission;
  updateAction: (missionId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteAction: (missionId: string) => Promise<{ error?: string }>;
}) {
  const controls = useDragControls();
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();
  const draggedRef = useRef(false);

  return (
    <Reorder.Item
      value={m}
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
          <MissionTypeIcon type={m.type} className="h-6 w-6 shrink-0" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-medium">{m.title}</span>
            <span className="shrink-0 text-xs opacity-50">
              +{m.points} pts{!m.is_active && " · inativa"}
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
                const { error } = await updateAction(m.id, formData);
                if (error) toast.error(traduzirErro(error));
                else toast.success("Missão salva.");
              });
            }}
          >
            <MissionFields mission={m} />
            <div className="flex justify-end">
              <Button type="submit" className="px-3 py-1.5" disabled={pending}>
                {pending ? "Salvando…" : "Salvar missão"}
              </Button>
            </div>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startDeleteTransition(async () => {
                const { error } = await deleteAction(m.id);
                if (error) toast.error(traduzirErro(error));
              });
            }}
          >
            <button
              type="submit"
              disabled={deleting}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {deleting ? "Excluindo…" : "Excluir missão"}
            </button>
          </form>
        </div>
      </details>
    </Reorder.Item>
  );
}
