"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { formatarDuracao, formatarHorario, partesNoFuso } from "@/lib/scheduling";
import type { AppointmentDetalhado, AppointmentStatus, Provider } from "@/lib/types";

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

interface DayAgendaProps {
  agendamentos: AppointmentDetalhado[];
  providers: Provider[];
  timeZone: string;
  labelClient: string;
  slotsAction: (
    providerId: string,
    procedureId: string | null,
    dateISO: string,
    ignorarAppointmentId?: string,
  ) => Promise<{ slots?: string[]; error?: string }>;
  statusAction: (id: string, status: AppointmentStatus) => Promise<{ error?: string }>;
  rescheduleAction: (id: string, formData: FormData) => Promise<{ error?: string }>;
  deleteAction: (id: string) => Promise<{ error?: string }>;
}

// Lista do dia selecionado, em ordem de horário, com as ações de cada
// atendimento (concluir, cancelar, remarcar, excluir).
export function DayAgenda({
  agendamentos,
  providers,
  timeZone,
  labelClient,
  slotsAction,
  statusAction,
  rescheduleAction,
  deleteAction,
}: DayAgendaProps) {
  if (agendamentos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm opacity-60 dark:border-white/15">
        Nenhum atendimento nesse dia.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {agendamentos.map((a) => (
        <AppointmentRow
          key={a.id}
          agendamento={a}
          providers={providers}
          timeZone={timeZone}
          labelClient={labelClient}
          slotsAction={slotsAction}
          statusAction={statusAction}
          rescheduleAction={rescheduleAction}
          deleteAction={deleteAction}
        />
      ))}
    </ul>
  );
}

function AppointmentRow({
  agendamento: a,
  providers,
  timeZone,
  labelClient,
  slotsAction,
  statusAction,
  rescheduleAction,
  deleteAction,
}: {
  agendamento: AppointmentDetalhado;
} & Omit<DayAgendaProps, "agendamentos">) {
  const [remarcando, setRemarcando] = useState(false);
  const [pendente, iniciar] = useTransition();

  function executar(acao: () => Promise<{ error?: string }>, sucesso: string) {
    iniciar(async () => {
      const { error } = await acao();
      if (error) toast.error(error);
      else toast.success(sucesso);
    });
  }

  const cliente = a.users?.full_name ?? a.users?.email ?? "Cliente removido";
  const cor = a.providers?.color ?? "#64748B";

  return (
    <li className="rounded-xl border border-black/10 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-start gap-3">
        <span
          aria-hidden
          className="mt-1 h-10 w-1 shrink-0 rounded-full"
          style={{ background: cor }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tabular-nums">
              {formatarHorario(a.scheduled_at, timeZone)}
            </span>
            <span className="text-xs opacity-50">
              {formatarDuracao(a.duration_min)}
            </span>
            <Badge className={STATUS_STYLE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
          </div>

          <p className="mt-0.5 truncate text-sm font-medium">{a.title}</p>
          <p className="truncate text-xs opacity-60">
            {labelClient}: {cliente}
            {a.providers ? ` · ${a.providers.name}` : ""}
          </p>
          {a.notes && <p className="mt-1 text-xs opacity-60">{a.notes}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {pendente && <Spinner className="opacity-60" />}

          {a.status === "scheduled" && (
            <>
              <button
                type="button"
                disabled={pendente}
                onClick={() =>
                  executar(() => statusAction(a.id, "completed"), "Atendimento concluído.")
                }
                className="rounded-lg px-2 py-1 text-xs font-medium text-green-600 transition hover:bg-green-500/10 disabled:opacity-50"
              >
                Concluir
              </button>
              <button
                type="button"
                disabled={pendente}
                onClick={() => setRemarcando((v) => !v)}
                className={cn(
                  "rounded-lg px-2 py-1 text-xs font-medium transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10",
                  remarcando && "bg-black/5 dark:bg-white/10",
                )}
              >
                Remarcar
              </button>
              <button
                type="button"
                disabled={pendente}
                onClick={() =>
                  executar(() => statusAction(a.id, "cancelled"), "Agendamento cancelado.")
                }
                className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                Cancelar
              </button>
            </>
          )}

          <button
            type="button"
            disabled={pendente}
            aria-label="Excluir agendamento"
            onClick={() => executar(() => deleteAction(a.id), "Agendamento excluído.")}
            className="rounded-lg p-1.5 opacity-40 transition hover:bg-red-500/10 hover:text-red-600 hover:opacity-100 disabled:opacity-30"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {remarcando && (
        <RescheduleForm
          agendamento={a}
          providers={providers}
          timeZone={timeZone}
          slotsAction={slotsAction}
          rescheduleAction={rescheduleAction}
          onPronto={() => setRemarcando(false)}
        />
      )}
    </li>
  );
}

function RescheduleForm({
  agendamento: a,
  providers,
  timeZone,
  slotsAction,
  rescheduleAction,
  onPronto,
}: {
  agendamento: AppointmentDetalhado;
  providers: Provider[];
  timeZone: string;
  slotsAction: DayAgendaProps["slotsAction"];
  rescheduleAction: DayAgendaProps["rescheduleAction"];
  onPronto: () => void;
}) {
  const [providerId, setProviderId] = useState(a.provider_id ?? providers[0]?.id ?? "");
  const [date, setDate] = useState(partesNoFuso(a.scheduled_at, timeZone).date);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [salvando, iniciar] = useTransition();

  useEffect(() => {
    if (!providerId || !date) return;
    let cancelado = false;

    slotsAction(providerId, a.procedure_id, date, a.id).then(({ slots: livres, error }) => {
      if (cancelado) return;
      if (error) toast.error(error);
      setSlots(livres ?? []);
    });

    return () => {
      cancelado = true;
    };
  }, [slotsAction, providerId, date, a.procedure_id, a.id]);

  function remarcar(time: string) {
    const formData = new FormData();
    formData.set("date", date);
    formData.set("time", time);
    formData.set("provider_id", providerId);

    iniciar(async () => {
      const { error } = await rescheduleAction(a.id, formData);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Agendamento remarcado.");
      onPronto();
    });
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-black/[0.03] p-3 dark:bg-white/[0.04]">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-medium opacity-70">Profissional</span>
          <Select
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value);
              setSlots(null);
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium opacity-70">Nova data</span>
          <DatePicker
            value={date}
            onChange={(dia) => {
              setDate(dia);
              setSlots(null);
            }}
          />
        </label>
      </div>

      {slots === null ? (
        <p className="flex items-center gap-2 text-xs opacity-60">
          <Spinner className="h-3.5 w-3.5" /> Buscando horários…
        </p>
      ) : slots.length === 0 ? (
        <p className="text-xs opacity-60">Sem horário livre nessa data.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((slot) => (
            <Button
              key={slot}
              type="button"
              variant="outline"
              className="px-2.5 py-1 text-xs tabular-nums"
              disabled={salvando}
              onClick={() => remarcar(slot)}
            >
              {slot}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
