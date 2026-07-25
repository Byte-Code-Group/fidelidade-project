"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TIMEZONES } from "@/lib/timezones";

export function TimezoneForm({
  timeZone,
  saveAction,
}: {
  timeZone: string;
  saveAction: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [salvando, iniciar] = useTransition();

  return (
    <form
      action={(formData) =>
        iniciar(async () => {
          const { error } = await saveAction(formData);
          if (error) toast.error(error);
          else toast.success("Fuso horário salvo.");
        })
      }
      className="flex flex-wrap items-end gap-3"
    >
      <label className="min-w-[240px] flex-1 text-sm">
        <span className="mb-1 block font-medium">Fuso do negócio</span>
        <Select name="timezone" defaultValue={timeZone}>
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </Select>
      </label>
      <Button type="submit" pendingLabel="Salvando…" disabled={salvando}>
        Salvar fuso
      </Button>
    </form>
  );
}
