"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";
import { formatarDuracao, formatarPreco } from "@/lib/scheduling";
import type { Procedure } from "@/lib/types";

type Resultado = Promise<{ error?: string }>;

interface ProceduresManagerProps {
  procedures: Procedure[];
  createAction: (formData: FormData) => Resultado;
  updateAction: (procedureId: string, formData: FormData) => Resultado;
  deleteAction: (procedureId: string) => Resultado;
}

// Catálogo de procedimentos. A duração aqui é o que define o tamanho do slot
// oferecido na agenda — mudar de 30 para 60 min muda os horários disponíveis.
export function ProceduresManager({
  procedures,
  createAction,
  updateAction,
  deleteAction,
}: ProceduresManagerProps) {
  const [novo, setNovo] = useState(false);

  return (
    <div className="space-y-2">
      {procedures.length === 0 && !novo && (
        <p className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center text-sm opacity-60 dark:border-white/15">
          Nenhum procedimento cadastrado. Ex.: “Consulta · 30 min”, “Limpeza · 50 min”.
        </p>
      )}

      {procedures.map((p) => (
        <ProcedureRow
          key={p.id}
          procedure={p}
          updateAction={updateAction}
          deleteAction={deleteAction}
        />
      ))}

      {novo ? (
        <ProcedureForm
          onCancelar={() => setNovo(false)}
          onSalvar={async (formData) => {
            const { error } = await createAction(formData);
            if (error) {
              toast.error(error);
              return;
            }
            toast.success("Procedimento cadastrado.");
            setNovo(false);
          }}
        />
      ) : (
        <Button type="button" variant="outline" onClick={() => setNovo(true)}>
          + Novo procedimento
        </Button>
      )}
    </div>
  );
}

function ProcedureRow({
  procedure: p,
  updateAction,
  deleteAction,
}: {
  procedure: Procedure;
  updateAction: (procedureId: string, formData: FormData) => Resultado;
  deleteAction: (procedureId: string) => Resultado;
}) {
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const preco = formatarPreco(p.price_cents);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10">
      <div className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-semibold">
            {p.name}
            {!p.is_active && (
              <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-medium uppercase opacity-70 dark:bg-white/15">
                inativo
              </span>
            )}
          </p>
          <p className="truncate text-xs opacity-55">
            {formatarDuracao(p.duration_min)}
            {preco ? ` · ${preco}` : ""}
            {p.description ? ` · ${p.description}` : ""}
          </p>
        </div>

        {pendente && <Spinner className="opacity-60" />}
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className="rounded-lg p-1.5 opacity-50 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          aria-label="Editar procedimento"
        >
          <Icon name="edit" className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const { error } = await deleteAction(p.id);
              if (error) toast.error(error);
              else toast.success("Procedimento excluído.");
            })
          }
          className="rounded-lg p-1.5 opacity-40 transition hover:bg-red-500/10 hover:text-red-600 hover:opacity-100"
          aria-label="Excluir procedimento"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      {editando && (
        <div className="border-t border-black/5 p-3 dark:border-white/10">
          <ProcedureForm
            procedure={p}
            onCancelar={() => setEditando(false)}
            onSalvar={async (formData) => {
              const { error } = await updateAction(p.id, formData);
              if (error) {
                toast.error(error);
                return;
              }
              toast.success("Procedimento salvo.");
              setEditando(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function ProcedureForm({
  procedure,
  onSalvar,
  onCancelar,
}: {
  procedure?: Procedure;
  onSalvar: (formData: FormData) => Promise<void>;
  onCancelar: () => void;
}) {
  const [salvando, iniciar] = useTransition();

  return (
    <form
      action={(formData) =>
        iniciar(async () => {
          await onSalvar(formData);
        })
      }
      className="space-y-3 rounded-xl bg-black/[0.03] p-3 dark:bg-white/[0.04]"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm sm:col-span-3">
          <span className="mb-1 block font-medium">Nome</span>
          <Input name="name" required defaultValue={procedure?.name} placeholder="Consulta" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Duração (min)</span>
          <Input
            name="duration_min"
            type="number"
            min={5}
            max={600}
            step={5}
            required
            defaultValue={procedure?.duration_min ?? 30}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Preço</span>
          <Input
            name="price"
            defaultValue={
              procedure?.price_cents !== null && procedure?.price_cents !== undefined
                ? (procedure.price_cents / 100).toFixed(2).replace(".", ",")
                : ""
            }
            placeholder="Opcional — ex.: 150,00"
          />
        </label>

        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={procedure?.is_active ?? true}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Ativo
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Descrição</span>
        <Textarea
          name="description"
          rows={2}
          defaultValue={procedure?.description ?? ""}
          placeholder="Opcional — aparece para o cliente na hora de marcar"
        />
      </label>

      <div className="flex gap-2">
        <Button type="submit" pendingLabel="Salvando…" disabled={salvando}>
          {procedure ? "Salvar" : "Cadastrar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
