"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatarDataHora, formatarDuracao } from "@/lib/scheduling";
import type { AppointmentDetalhado, AppointmentStatus } from "@/lib/types";

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-600",
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

// Próximos atendimentos do cliente, com opção de cancelar.
export function ClientAppointments({
  agendamentos,
  timeZone,
  cancelAction,
}: {
  agendamentos: AppointmentDetalhado[];
  timeZone: string;
  cancelAction: (appointmentId: string) => Promise<{ error?: string }>;
}) {
  return (
    <Card>
      <div className="divide-y divide-black/5">
        {agendamentos.map((a) => (
          <Row key={a.id} agendamento={a} timeZone={timeZone} cancelAction={cancelAction} />
        ))}
      </div>
    </Card>
  );
}

function Row({
  agendamento: a,
  timeZone,
  cancelAction,
}: {
  agendamento: AppointmentDetalhado;
  timeZone: string;
  cancelAction: (appointmentId: string) => Promise<{ error?: string }>;
}) {
  const [pendente, iniciar] = useTransition();
  const data = new Date(a.scheduled_at);

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--primary)]/10 text-center leading-tight">
        <span className="text-[10px] font-medium uppercase text-[var(--primary)] opacity-70">
          {data.toLocaleDateString("pt-BR", { timeZone, month: "short" })}
        </span>
        <span className="text-lg font-bold text-[var(--primary)]">
          {data.toLocaleDateString("pt-BR", { timeZone, day: "numeric" })}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-medium">{a.title}</p>
        <p className="text-xs opacity-60">
          {formatarDataHora(a.scheduled_at, timeZone)} · {formatarDuracao(a.duration_min)}
        </p>
        {a.providers && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs opacity-60">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: a.providers.color }}
              aria-hidden
            />
            {a.providers.name}
          </p>
        )}
        {a.notes && <p className="mt-1 text-xs opacity-50">{a.notes}</p>}

        {a.status === "scheduled" && (
          <button
            type="button"
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const { error } = await cancelAction(a.id);
                if (error) toast.error(error);
                else toast.success("Agendamento cancelado.");
              })
            }
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 transition hover:underline disabled:opacity-50"
          >
            {pendente && <Spinner className="h-3 w-3" />}
            Cancelar
          </button>
        )}
      </div>

      <Badge className={STATUS_STYLE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
    </div>
  );
}
