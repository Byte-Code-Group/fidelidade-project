"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeInput } from "@/components/ui/time-input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  formatarDataLonga,
  minutosDoHorario,
} from "@/lib/scheduling";
import type {
  Procedure,
  Provider,
  ProviderSchedule,
  ScheduleException,
} from "@/lib/types";

const CORES = [
  "#2563EB",
  "#0EA5A4",
  "#7C3AED",
  "#DB2777",
  "#EA580C",
  "#16A34A",
  "#CA8A04",
  "#475569",
];

type Resultado = Promise<{ error?: string }>;

interface ProvidersManagerProps {
  providers: Provider[];
  schedules: ProviderSchedule[];
  exceptions: ScheduleException[];
  procedures: Procedure[];
  vinculos: { provider_id: string; procedure_id: string }[];
  createAction: (formData: FormData) => Resultado;
  updateAction: (providerId: string, formData: FormData) => Resultado;
  deleteAction: (providerId: string) => Resultado;
  createScheduleAction: (formData: FormData) => Resultado;
  deleteScheduleAction: (scheduleId: string) => Resultado;
  copyDayAction: (providerId: string, origem: number, destinos: number[]) => Resultado;
  createExceptionAction: (formData: FormData) => Resultado;
  deleteExceptionAction: (exceptionId: string) => Resultado;
}

// Profissionais + horário de trabalho semanal + folgas + procedimentos que
// cada um atende. Tudo numa tela porque na prática se configura junto.
export function ProvidersManager(props: ProvidersManagerProps) {
  const { providers } = props;
  const [novo, setNovo] = useState(false);

  return (
    <div className="space-y-3">
      {providers.length === 0 && !novo && (
        <p className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center text-sm opacity-60 dark:border-white/15">
          Nenhum profissional cadastrado. Comece por aqui — sem profissional não
          existe horário para marcar.
        </p>
      )}

      {providers.map((p) => (
        <ProviderCard key={p.id} provider={p} {...props} />
      ))}

      {novo ? (
        <ProviderForm
          procedures={props.procedures}
          procedimentosSelecionados={[]}
          onCancelar={() => setNovo(false)}
          onSalvar={async (formData) => {
            const { error } = await props.createAction(formData);
            if (error) {
              toast.error(error);
              return false;
            }
            toast.success("Profissional cadastrado.");
            setNovo(false);
            return true;
          }}
        />
      ) : (
        <Button type="button" variant="outline" onClick={() => setNovo(true)}>
          + Novo profissional
        </Button>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  schedules,
  exceptions,
  procedures,
  vinculos,
  updateAction,
  deleteAction,
  createScheduleAction,
  deleteScheduleAction,
  copyDayAction,
  createExceptionAction,
  deleteExceptionAction,
}: { provider: Provider } & ProvidersManagerProps) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();

  const meusHorarios = schedules.filter((s) => s.provider_id === provider.id);
  const minhasFolgas = exceptions.filter(
    (e) => e.provider_id === provider.id || e.provider_id === null,
  );
  const meusProcedimentos = vinculos
    .filter((v) => v.provider_id === provider.id)
    .map((v) => v.procedure_id);

  const totalBlocos = meusHorarios.length;

  // Sem vínculo = atende todos (contrato de provider_procedures).
  const nomesProcedimentos = procedures
    .filter((p) => meusProcedimentos.includes(p.id))
    .map((p) => p.name);
  const resumoProcedimentos =
    nomesProcedimentos.length === 0
      ? "todos os procedimentos"
      : nomesProcedimentos.length <= 3
        ? nomesProcedimentos.join(", ")
        : `${nomesProcedimentos.slice(0, 3).join(", ")} +${nomesProcedimentos.length - 3}`;

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10">
      <div className="flex items-center gap-3 p-3">
        <span
          className="h-8 w-8 shrink-0 rounded-lg"
          style={{ background: provider.color }}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="flex items-center gap-2 truncate text-sm font-semibold">
            {provider.name}
            {!provider.is_active && (
              <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-medium uppercase opacity-70 dark:bg-white/15">
                inativo
              </span>
            )}
          </p>
          <p className="truncate text-xs opacity-55">
            {provider.specialty ? `${provider.specialty} · ` : ""}
            {totalBlocos === 0
              ? "sem horário de trabalho"
              : `${totalBlocos} bloco(s) de horário`}
            {" · "}
            {resumoProcedimentos}
          </p>
        </button>

        {pendente && <Spinner className="opacity-60" />}
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className="rounded-lg p-1.5 opacity-50 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          aria-label="Editar profissional"
        >
          <Icon name="edit" className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const { error } = await deleteAction(provider.id);
              if (error) toast.error(error);
              else toast.success("Profissional excluído.");
            })
          }
          className="rounded-lg p-1.5 opacity-40 transition hover:bg-red-500/10 hover:text-red-600 hover:opacity-100"
          aria-label="Excluir profissional"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="rounded-lg px-2 py-1 text-xs opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          {aberto ? "Fechar" : "Horários"}
        </button>
      </div>

      {editando && (
        <div className="border-t border-black/5 p-3 dark:border-white/10">
          <ProviderForm
            provider={provider}
            procedures={procedures}
            procedimentosSelecionados={meusProcedimentos}
            onCancelar={() => setEditando(false)}
            onSalvar={async (formData) => {
              const { error } = await updateAction(provider.id, formData);
              if (error) {
                toast.error(error);
                return false;
              }
              toast.success("Profissional salvo.");
              setEditando(false);
              return true;
            }}
          />
        </div>
      )}

      {aberto && (
        <div className="space-y-4 border-t border-black/5 p-3 dark:border-white/10">
          <WeekSchedule
            provider={provider}
            horarios={meusHorarios}
            createAction={createScheduleAction}
            deleteAction={deleteScheduleAction}
            copyDayAction={copyDayAction}
          />

          <ExceptionsBlock
            provider={provider}
            folgas={minhasFolgas}
            createAction={createExceptionAction}
            deleteAction={deleteExceptionAction}
          />
        </div>
      )}
    </div>
  );
}

function ProviderForm({
  provider,
  procedures,
  procedimentosSelecionados,
  onSalvar,
  onCancelar,
}: {
  provider?: Provider;
  procedures: Procedure[];
  procedimentosSelecionados: string[];
  onSalvar: (formData: FormData) => Promise<boolean>;
  onCancelar: () => void;
}) {
  const [cor, setCor] = useState(provider?.color ?? CORES[0]);
  const [marcados, setMarcados] = useState<string[]>(procedimentosSelecionados);
  const [salvando, iniciar] = useTransition();

  return (
    <form
      action={(formData) => {
        formData.set("color", cor);
        // Um valor por procedimento marcado — o servidor lê com getAll
        // (ver procedimentosDoForm em lib/providers.ts).
        formData.delete("procedure_ids");
        for (const id of marcados) formData.append("procedure_ids", id);
        iniciar(async () => {
          await onSalvar(formData);
        });
      }}
      className="space-y-3 rounded-xl bg-black/[0.03] p-3 dark:bg-white/[0.04]"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nome</span>
          <Input name="name" required defaultValue={provider?.name} placeholder="Dra. Ana Souza" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Especialidade</span>
          <Input
            name="specialty"
            defaultValue={provider?.specialty ?? ""}
            placeholder="Ortodontia (opcional)"
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium">Cor no calendário</p>
        <div className="flex flex-wrap gap-1.5">
          {CORES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              aria-pressed={c === cor}
              onClick={() => setCor(c)}
              className={cn(
                "h-7 w-7 rounded-lg transition",
                c === cor ? "ring-2 ring-offset-2 ring-[var(--primary)]" : "opacity-70",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Procedimentos que atende</p>
        {procedures.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/10 px-3 py-2 text-xs opacity-60 dark:border-white/15">
            Nenhum procedimento cadastrado ainda. Cadastre em “Procedimentos”,
            logo abaixo, e depois edite este profissional para marcar quais ele
            atende.
          </p>
        ) : (
          <>
            <p className="mb-1.5 text-xs opacity-55">
              Só os marcados são oferecidos ao cliente quando ele escolhe este
              profissional. Nenhum marcado = atende todos.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {procedures.map((p) => {
                const ativo = marcados.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() =>
                      setMarcados((atual) =>
                        atual.includes(p.id)
                          ? atual.filter((x) => x !== p.id)
                          : [...atual, p.id],
                      )
                    }
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs transition",
                      ativo
                        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-black/10 opacity-70 hover:opacity-100 dark:border-white/15",
                      !p.is_active && "line-through",
                    )}
                  >
                    {ativo ? "✓ " : "+ "}
                    {p.name}
                    <span className="ml-1 opacity-60">{p.duration_min}min</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={provider?.is_active ?? true}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        Ativo (aparece para agendar)
      </label>

      <div className="flex gap-2">
        <Button type="submit" pendingLabel="Salvando…" disabled={salvando}>
          {provider ? "Salvar" : "Cadastrar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function WeekSchedule({
  provider,
  horarios,
  createAction,
  deleteAction,
  copyDayAction,
}: {
  provider: Provider;
  horarios: ProviderSchedule[];
  createAction: (formData: FormData) => Resultado;
  deleteAction: (scheduleId: string) => Resultado;
  copyDayAction: (providerId: string, origem: number, destinos: number[]) => Resultado;
}) {
  const [pendente, iniciar] = useTransition();

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Horário de trabalho</p>
      <p className="mb-3 text-xs opacity-55">
        Vários blocos por dia são permitidos — cadastre manhã e tarde separadas
        para o almoço ficar de fora.
      </p>

      <div className="space-y-2">
        {WEEKDAY_LABELS.map((label, weekday) => {
          const doDia = horarios
            .filter((h) => h.weekday === weekday)
            .sort((a, b) => minutosDoHorario(a.start_time) - minutosDoHorario(b.start_time));

          return (
            <div
              key={weekday}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-black/[0.03] px-3 py-2 dark:bg-white/[0.04]"
            >
              <span className="w-16 shrink-0 text-xs font-medium opacity-70">{label}</span>

              {doDia.length === 0 ? (
                <span className="text-xs opacity-45">fechado</span>
              ) : (
                doDia.map((h) => (
                  <span
                    key={h.id}
                    className="flex items-center gap-1 rounded-md bg-[var(--primary)]/10 px-2 py-1 text-xs tabular-nums"
                  >
                    {h.start_time.slice(0, 5)}–{h.end_time.slice(0, 5)}
                    <button
                      type="button"
                      disabled={pendente}
                      aria-label="Remover bloco"
                      onClick={() =>
                        iniciar(async () => {
                          const { error } = await deleteAction(h.id);
                          if (error) toast.error(error);
                        })
                      }
                      className="opacity-50 transition hover:text-red-600 hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}

              <form
                action={(formData) => {
                  formData.set("provider_id", provider.id);
                  formData.set("weekday", String(weekday));
                  iniciar(async () => {
                    const { error } = await createAction(formData);
                    if (error) toast.error(error);
                  });
                }}
                className="ml-auto flex items-center gap-1"
              >
                <TimeInput
                  name="start_time"
                  required
                  className="w-[76px] px-2 py-1 text-center text-xs tabular-nums"
                  aria-label={`Início em ${label}`}
                />
                <TimeInput
                  name="end_time"
                  required
                  className="w-[76px] px-2 py-1 text-center text-xs tabular-nums"
                  aria-label={`Fim em ${label}`}
                />
                <Button type="submit" variant="outline" className="px-2 py-1 text-xs">
                  Adicionar
                </Button>
              </form>

              {doDia.length > 0 && (
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() =>
                    iniciar(async () => {
                      const { error } = await copyDayAction(provider.id, weekday, [1, 2, 3, 4, 5]);
                      if (error) toast.error(error);
                      else toast.success("Horário copiado para segunda a sexta.");
                    })
                  }
                  className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50"
                >
                  copiar p/ seg–sex
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExceptionsBlock({
  provider,
  folgas,
  createAction,
  deleteAction,
}: {
  provider: Provider;
  folgas: ScheduleException[];
  createAction: (formData: FormData) => Resultado;
  deleteAction: (exceptionId: string) => Resultado;
}) {
  const [pendente, iniciar] = useTransition();
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [dataFolga, setDataFolga] = useState("");

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Folgas e bloqueios</p>

      {folgas.length > 0 && (
        <ul className="mb-2 space-y-1">
          {folgas.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-lg bg-black/[0.03] px-3 py-1.5 text-xs dark:bg-white/[0.04]"
            >
              <span className="font-medium">{formatarDataLonga(f.exception_date)}</span>
              <span className="opacity-60">
                {f.start_time && f.end_time
                  ? `${f.start_time.slice(0, 5)}–${f.end_time.slice(0, 5)}`
                  : "dia inteiro"}
                {f.provider_id === null ? " · negócio fechado" : ""}
                {f.reason ? ` · ${f.reason}` : ""}
              </span>
              <button
                type="button"
                disabled={pendente}
                aria-label="Remover folga"
                onClick={() =>
                  iniciar(async () => {
                    const { error } = await deleteAction(f.id);
                    if (error) toast.error(error);
                  })
                }
                className="ml-auto opacity-50 transition hover:text-red-600 hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        action={(formData) => {
          formData.set("provider_id", String(formData.get("escopo")) === "all" ? "all" : provider.id);
          iniciar(async () => {
            const { error } = await createAction(formData);
            if (error) {
              toast.error(error);
              return;
            }
            toast.success("Folga cadastrada.");
            // O reset do form não alcança o DatePicker (é estado, não input).
            setDataFolga("");
          });
        }}
        className="flex flex-wrap items-end gap-2 rounded-lg bg-black/[0.03] p-2.5 dark:bg-white/[0.04]"
      >
        <div className="text-xs">
          <span className="mb-1 block font-medium opacity-70">Data</span>
          <DatePicker
            name="exception_date"
            required
            aria-label="Data da folga"
            className="w-[210px]"
            value={dataFolga}
            onChange={setDataFolga}
          />
        </div>

        <label className="text-xs">
          <span className="mb-1 block font-medium opacity-70">Vale para</span>
          <Select name="escopo" className="px-2 py-1 text-xs" defaultValue="provider">
            <option value="provider">Só {provider.name}</option>
            <option value="all">Negócio inteiro</option>
          </Select>
        </label>

        <label className="flex items-center gap-1.5 pb-1.5 text-xs">
          <input
            type="checkbox"
            name="all_day"
            checked={diaInteiro}
            onChange={(e) => setDiaInteiro(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--primary)]"
          />
          Dia inteiro
        </label>

        {!diaInteiro && (
          <>
            <label className="text-xs">
              <span className="mb-1 block font-medium opacity-70">De</span>
              <TimeInput
                name="start_time"
                className="w-[76px] px-2 py-1 text-center text-xs tabular-nums"
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-medium opacity-70">Até</span>
              <TimeInput
                name="end_time"
                className="w-[76px] px-2 py-1 text-center text-xs tabular-nums"
              />
            </label>
          </>
        )}

        <label className="min-w-[140px] flex-1 text-xs">
          <span className="mb-1 block font-medium opacity-70">Motivo</span>
          <Input name="reason" className="px-2 py-1 text-xs" placeholder="Opcional" />
        </label>

        <Button type="submit" variant="outline" className="px-2.5 py-1.5 text-xs">
          Adicionar
        </Button>
      </form>
    </div>
  );
}

export { WEEKDAY_SHORT };
