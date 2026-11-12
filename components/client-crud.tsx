"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { traduzirErro } from "@/lib/error-messages";

type Action = (formData: FormData) => Promise<{ error?: string } | void>;

// onSubmit em vez de <form action>: o React limpa o form depois da action, e
// num erro de validação o dono perderia tudo que digitou.
export function ClientFormShell({ action, submitLabel, children }: { action: Action; submitLabel: string; children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) toast.error(traduzirErro(result.error));
        });
      }}
      className="space-y-5"
    >
      {children}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Spinner className="mr-2" />}
          {pending ? "Salvando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function DeleteClientButton({ name, action }: { name: string; action: () => Promise<{ error?: string } | void> }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/5"
      >
        Excluir
      </button>
      <Modal open={open} title="Excluir cliente" onClose={() => !pending && setOpen(false)}>
        <p className="text-sm">
          Excluir <strong>{name}</strong> apaga a conta, a carteirinha, os pontos, os agendamentos e os documentos dele.
          Se ele tiver assinatura no Asaas, a cobrança é cancelada. <strong>Não dá para desfazer.</strong>
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await action();
                if (result?.error) toast.error(traduzirErro(result.error));
              })
            }
            className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending && <Spinner className="mr-2" />}
            Excluir de vez
          </button>
        </div>
      </Modal>
    </>
  );
}
