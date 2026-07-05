"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/form-field";
import { Icon } from "@/components/icons";
import { SOCIAL_NETWORKS, SocialLogo, isSocialKey } from "@/components/social-logos";
import type { Mission, MissionType } from "@/lib/types";

const TYPES: { value: MissionType; label: string }[] = [
  ...SOCIAL_NETWORKS.map((s) => ({ value: s.key as MissionType, label: s.label })),
  { value: "custom", label: "Personalizada" },
];

export function MissionTypeIcon({ type, className }: { type: MissionType; className?: string }) {
  return isSocialKey(type) ? (
    <SocialLogo name={type} className={className} />
  ) : (
    <Icon name="award" className={className} />
  );
}

export function MissionFields({ mission }: { mission?: Mission }) {
  const [type, setType] = useState<MissionType>(mission?.type ?? "custom");

  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Título">
          <Input name="title" defaultValue={mission?.title ?? ""} required />
        </Field>
        <Field label="Pontos">
          <Input
            name="points"
            type="number"
            min={0}
            defaultValue={mission?.points ?? 0}
            className="w-24"
          />
        </Field>
      </div>

      <Field label="Descrição">
        <Input
          name="description"
          defaultValue={mission?.description ?? ""}
          placeholder="opcional"
        />
      </Field>

      <Field label="Tipo" hint="define o ícone, sempre travado">
        <div className="flex items-center gap-2">
          <MissionTypeIcon type={type} className="h-8 w-8 shrink-0" />
          <Select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as MissionType)}
            className="flex-1"
          >
            {TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Field>

      <Field label="URL externa" hint="opcional">
        <Input
          name="external_url"
          defaultValue={mission?.external_url ?? ""}
          placeholder="https://instagram.com/..."
        />
      </Field>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requires_validation"
            defaultChecked={mission?.requires_validation ?? false}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Exige validação
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={mission?.is_active ?? true}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Ativa
        </label>
      </div>
    </>
  );
}
