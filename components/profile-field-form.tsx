import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ProfileField } from "@/lib/types";

const FIELD_TYPES = [
  ["text", "Texto"],
  ["textarea", "Texto longo"],
  ["date", "Data"],
  ["select", "Lista de opções"],
  ["cpf", "CPF"],
  ["birthdate", "Data de nascimento"],
  ["address", "Endereço"],
] as const;

export function ProfileFieldForm({ field }: { field?: ProfileField }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper label="Rótulo (visível ao cliente)">
          <Input name="label" defaultValue={field?.label ?? ""} required />
        </FieldWrapper>
        <FieldWrapper label="Chave interna" hint="sem espaços, sem acentos">
          <Input
            name="field_key"
            defaultValue={field?.field_key ?? ""}
            required
            placeholder="data_nascimento"
          />
        </FieldWrapper>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FieldWrapper label="Tipo">
          <Select name="field_type" defaultValue={field?.field_type ?? "text"}>
            {FIELD_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </FieldWrapper>
        <FieldWrapper label="Ordem">
          <Input
            name="display_order"
            type="number"
            defaultValue={field?.display_order ?? 0}
          />
        </FieldWrapper>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="required"
              defaultChecked={field?.required ?? false}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Obrigatório
          </label>
        </div>
      </div>

      <FieldWrapper
        label="Limite de caracteres"
        hint="opcional — só vale para tipo Texto e Texto longo"
      >
        <Input
          name="max_length"
          type="number"
          min={1}
          defaultValue={field?.max_length ?? ""}
          placeholder="ex.: 200"
        />
      </FieldWrapper>

      <FieldWrapper
        label="Opções"
        hint="apenas para tipo Lista de opções — uma por linha"
      >
        <textarea
          name="options"
          defaultValue={(field?.options ?? []).join("\n")}
          rows={3}
          placeholder={"Opção 1\nOpção 2\nOpção 3"}
          style={{
            width: "100%",
            minHeight: 80,
            resize: "vertical",
            borderRadius: 8,
            border: "1px solid rgba(128,128,128,0.4)",
            background: "transparent",
            padding: "8px 12px",
            fontSize: 13,
            color: "inherit",
          }}
        />
      </FieldWrapper>
    </>
  );
}

function FieldWrapper({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal opacity-50">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
