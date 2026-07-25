"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  formatarDuracao,
  formatarPreco,
  providersDoProcedimento,
} from "@/lib/scheduling";
import type { Procedure, Provider } from "@/lib/types";

interface BookingFormProps {
  providers: Provider[];
  procedures: Procedure[];
  vinculos: { provider_id: string; procedure_id: string }[];
  dataInicial: string;
  labelAppointment: string;
  slotsAction: (
    providerId: string,
    procedureId: string | null,
    dateISO: string,
  ) => Promise<{ slots?: string[]; error?: string }>;
  bookAction: (formData: FormData) => Promise<{ error?: string }>;
}

// Marcar do lado do cliente: escolhe o serviço, com quem e quando. Os horários
// vêm do servidor, então nunca é oferecido um horário já ocupado.
export function BookingForm({
  providers,
  procedures,
  vinculos,
  dataInicial,
  labelAppointment,
  slotsAction,
  bookAction,
}: BookingFormProps) {
  const [procedureId, setProcedureId] = useState(procedures[0]?.id ?? "");
  const [providerEscolhido, setProviderEscolhido] = useState("");
  const [date, setDate] = useState(dataInicial);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [versao, setVersao] = useState(0);
  const [salvando, iniciar] = useTransition();

  const habilitados = procedureId
    ? providersDoProcedimento(providers, vinculos, procedureId)
    : providers;

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

  function reiniciar() {
    setTime("");
    setSlots(null);
  }

  function marcar() {
    if (!time) {
      toast.error("Escolha um horário.");
      return;
    }

    const formData = new FormData();
    formData.set("provider_id", providerId);
    if (procedureId) formData.set("procedure_id", procedureId);
    formData.set("date", date);
    formData.set("time", time);
    if (notes) formData.set("notes", notes);

    iniciar(async () => {
      const { error } = await bookAction(formData);
      if (error) {
        toast.error(error);
        setSlots(null);
        setVersao((v) => v + 1);
        return;
      }
      toast.success(`${labelAppointment} marcado!`);
      setTime("");
      setNotes("");
      setSlots(null);
      setVersao((v) => v + 1);
    });
  }

  if (providers.length === 0 || procedures.length === 0) {
    return (
      <p className="rounded-xl bg-black/5 px-4 py-3 text-sm opacity-70 dark:bg-white/10">
        A agenda online ainda não está aberta. Fale com a recepção para marcar.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium">O que você precisa?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {procedures.map((p) => {
            const preco = formatarPreco(p.price_cents);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProcedureId(p.id);
                  reiniciar();
                }}
                aria-pressed={p.id === procedureId}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition",
                  p.id === procedureId
                    ? "border-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-black/10 hover:border-[var(--primary)]/50 dark:border-white/15",
                )}
              >
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs opacity-60">
                  {formatarDuracao(p.duration_min)}
                  {preco ? ` · ${preco}` : ""}
                </p>
                {p.description && (
                  <p className="mt-0.5 text-xs opacity-50">{p.description}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {habilitados.length > 1 && (
        <div>
          <p className="mb-1.5 text-sm font-medium">Com quem?</p>
          <div className="flex flex-wrap gap-2">
            {habilitados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProviderEscolhido(p.id);
                  reiniciar();
                }}
                aria-pressed={p.id === providerId}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                  p.id === providerId
                    ? "border-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-black/10 hover:border-[var(--primary)]/50 dark:border-white/15",
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: p.color }}
                  aria-hidden
                />
                <span>{p.name}</span>
                {p.specialty && <span className="text-xs opacity-50">{p.specialty}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Quando?</span>
          <Input
            type="date"
            value={date}
            min={dataInicial}
            onChange={(e) => {
              setDate(e.target.value);
              reiniciar();
            }}
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          Horários livres
          {slots === null && <Spinner className="h-3.5 w-3.5 opacity-60" />}
        </p>

        {slots !== null && slots.length === 0 ? (
          <p className="rounded-xl bg-black/5 px-3 py-2.5 text-sm opacity-70 dark:bg-white/10">
            Nenhum horário livre nesse dia. Tente outra data.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(slots ?? []).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setTime(slot)}
                aria-pressed={slot === time}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm tabular-nums transition",
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
        <span className="mb-1.5 block font-medium">Algo que devemos saber?</span>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional"
        />
      </label>

      <Button type="button" onClick={marcar} disabled={salvando || !time}>
        {salvando && <Spinner className="mr-2" />}
        {salvando ? "Marcando…" : `Confirmar ${labelAppointment.toLowerCase()}`}
      </Button>
    </div>
  );
}
