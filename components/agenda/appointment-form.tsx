"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  formatarDuracao,
  formatarPreco,
  providersDoProcedimento,
} from "@/lib/scheduling";
import type { Procedure, Provider } from "@/lib/types";

export interface ClienteOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface VinculoProcedimento {
  provider_id: string;
  procedure_id: string;
}

interface AppointmentFormProps {
  providers: Provider[];
  procedures: Procedure[];
  vinculos: VinculoProcedimento[];
  clientes: ClienteOption[];
  dataInicial: string;
  labelClient: string;
  slotsAction: (
    providerId: string,
    procedureId: string | null,
    dateISO: string,
  ) => Promise<{ slots?: string[]; error?: string }>;
  createAction: (formData: FormData) => Promise<{ error?: string }>;
  onCriado?: () => void;
}

// Marcar um horário: procedimento → profissional → data → horários livres.
// Os horários vêm do servidor (única fonte de verdade da disponibilidade), então
// nunca aparece um slot que já foi ocupado por outra pessoa.
export function AppointmentForm({
  providers,
  procedures,
  vinculos,
  clientes,
  dataInicial,
  labelClient,
  slotsAction,
  createAction,
  onCriado,
}: AppointmentFormProps) {
  const [procedureId, setProcedureId] = useState(procedures[0]?.id ?? "");
  const [providerEscolhido, setProviderEscolhido] = useState("");
  const [date, setDate] = useState(dataInicial);
  const [time, setTime] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [notes, setNotes] = useState("");

  // null = buscando no servidor. Os horários livres são sempre do servidor,
  // então nunca aparece slot que outra pessoa acabou de ocupar.
  const [slots, setSlots] = useState<string[] | null>(null);
  // Incrementa para forçar nova busca sem mudar os filtros (ex.: depois de
  // marcar, o horário usado precisa sair da lista).
  const [versao, setVersao] = useState(0);
  const [salvando, iniciarSalvamento] = useTransition();

  const procedimento = procedures.find((p) => p.id === procedureId) ?? null;
  const habilitados = procedureId
    ? providersDoProcedimento(providers, vinculos, procedureId)
    : providers;

  // Derivado, não estado: se o profissional escolhido não atende o
  // procedimento atual, o primeiro habilitado assume.
  const providerId = habilitados.some((p) => p.id === providerEscolhido)
    ? providerEscolhido
    : habilitados[0]?.id ?? "";

  useEffect(() => {
    if (!providerId || !date) return;
    let cancelado = false;

    slotsAction(providerId, procedureId || null, date).then(({ slots: livres, error }) => {
      if (cancelado) return;
      if (error) toast.error(error);
      setSlots(livres ?? []);
    });

    return () => {
      cancelado = true;
    };
  }, [slotsAction, providerId, procedureId, date, versao]);

  const carregandoSlots = slots === null;

  // Trocar qualquer parâmetro invalida o horário escolhido e volta ao estado
  // de busca — o efeito acima repõe a lista.
  function reiniciarBusca() {
    setTime("");
    setSlots(null);
  }

  function enviar() {
    if (!clienteId) {
      toast.error(`Selecione o ${labelClient.toLowerCase()}.`);
      return;
    }
    if (!time) {
      toast.error("Escolha um horário.");
      return;
    }

    const formData = new FormData();
    formData.set("user_id", clienteId);
    formData.set("provider_id", providerId);
    if (procedureId) formData.set("procedure_id", procedureId);
    formData.set("date", date);
    formData.set("time", time);
    if (notes) formData.set("notes", notes);

    iniciarSalvamento(async () => {
      const { error } = await createAction(formData);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Agendamento criado.");
      setTime("");
      setNotes("");
      setSlots(null);
      setVersao((v) => v + 1);
      onCriado?.();
    });
  }

  if (providers.length === 0 || procedures.length === 0) {
    return (
      <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
        Cadastre pelo menos um profissional e um procedimento em{" "}
        <strong>Configurações da agenda</strong> para começar a marcar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Procedimento</span>
          <Select
            value={procedureId}
            onChange={(e) => {
              setProcedureId(e.target.value);
              reiniciarBusca();
            }}
          >
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatarDuracao(p.duration_min)}
                {p.price_cents !== null ? ` · ${formatarPreco(p.price_cents)}` : ""}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Profissional</span>
          <Select
            value={providerId}
            onChange={(e) => {
              setProviderEscolhido(e.target.value);
              reiniciarBusca();
            }}
          >
            {habilitados.length === 0 && <option value="">Nenhum disponível</option>}
            {habilitados.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.specialty ? ` · ${p.specialty}` : ""}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{labelClient}</span>
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ?? c.email ?? "Sem nome"}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Data</span>
          <DatePicker
            value={date}
            onChange={(dia) => {
              setDate(dia);
              reiniciarBusca();
            }}
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          Horário
          {carregandoSlots && <Spinner className="h-3.5 w-3.5 opacity-60" />}
          {procedimento && (
            <span className="text-xs font-normal opacity-60">
              blocos de {formatarDuracao(procedimento.duration_min)}
            </span>
          )}
        </p>

        {!carregandoSlots && slots!.length === 0 ? (
          <p className="rounded-xl bg-black/5 px-3 py-2.5 text-sm opacity-70 dark:bg-white/10">
            Sem horário livre nesse dia para esse profissional. Tente outra data ou
            revise os horários de trabalho nas configurações.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(slots ?? []).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setTime(slot)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-sm tabular-nums transition",
                  slot === time
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border-black/10 hover:border-[var(--primary)] dark:border-white/15",
                )}
              >
                {slot}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Observações</span>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional — anotações internas sobre o atendimento"
        />
      </label>

      <Button type="button" onClick={enviar} disabled={salvando || !time}>
        {salvando && <Spinner className="mr-2" />}
        {salvando ? "Salvando…" : "Agendar"}
      </Button>
    </div>
  );
}
