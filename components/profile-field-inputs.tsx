import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MaskedInput } from "@/components/ui/masked-input";
import type { ProfileField } from "@/lib/types";

// O telefone é guardado em E.164 ("5531999998888") porque é o que a Meta
// exige no disparo; no formulário ele volta pro formato local que a máscara
// entende.
export function telefoneLocal(e164: string | null | undefined): string {
  if (!e164) return "";
  const digitos = e164.replace(/\D/g, "");
  return digitos.startsWith("55") && digitos.length >= 12 ? digitos.slice(2) : digitos;
}

// Grade de 2 colunas: campo "texto longo" sempre ocupa a linha inteira, e
// isso empurra o campo anterior/seguinte pra uma linha sozinho — nesse caso
// ele também estica pra linha inteira em vez de deixar buraco ao lado.
function layoutFields(fields: ProfileField[]): { field: ProfileField; full: boolean }[] {
  const result: { field: ProfileField; full: boolean }[] = [];
  let alone = false;

  for (const field of fields) {
    const forced = field.field_type === "textarea";
    if (forced) {
      if (alone) result[result.length - 1].full = true;
      result.push({ field, full: true });
      alone = false;
    } else {
      result.push({ field, full: false });
      alone = !alone;
    }
  }
  if (alone) result[result.length - 1].full = true;

  return result;
}

export function FieldWrapper({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className="mb-1 block text-sm opacity-70">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

/** Campos de cadastro do negócio, enviados como field_<id> (ver collectProfileFieldValues). */
export function ProfileFieldInputs({
  fields,
  values,
}: {
  fields: ProfileField[];
  values: Map<string, string | null>;
}) {
  return layoutFields(fields).map(({ field, full }) => {
    const value = values.get(field.id) ?? "";
    const name = `field_${field.id}`;
    return (
      <FieldWrapper key={field.id} label={field.label} required={field.required} full={full}>
        {field.field_type === "select" ? (
          <Select name={name} defaultValue={value}>
            <option value="">Selecione...</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        ) : field.field_type === "textarea" ? (
          <textarea
            name={name}
            defaultValue={value}
            maxLength={field.max_length ?? undefined}
            rows={4}
            style={{
              width: "100%",
              minHeight: 112,
              resize: "vertical",
              borderRadius: 8,
              border: "1px solid rgba(128,128,128,0.4)",
              background: "transparent",
              padding: "9px 12px",
              fontSize: 14,
              color: "inherit",
            }}
          />
        ) : field.field_type === "cpf" ? (
          <MaskedInput mask="cpf" name={name} defaultValue={value} required={field.required} placeholder="000.000.000-00" />
        ) : field.field_type === "phone" ? (
          <MaskedInput mask="phone" name={name} defaultValue={value} required={field.required} placeholder="(00) 00000-0000" />
        ) : field.field_type === "address" ? (
          <Input
            name={name}
            defaultValue={value}
            required={field.required}
            maxLength={field.max_length ?? undefined}
            placeholder="Rua, número, bairro, cidade"
          />
        ) : field.field_type === "date" || field.field_type === "birthdate" ? (
          <MaskedInput
            mask="date"
            name={name}
            defaultValue={value}
            required={field.required}
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
          />
        ) : (
          <Input name={name} type="text" defaultValue={value} required={field.required} maxLength={field.max_length ?? undefined} />
        )}
      </FieldWrapper>
    );
  });
}

/** Formulário do cliente no painel do dono: dados básicos + campos de cadastro do negócio. */
export function ClientFields({
  fields,
  values,
  client,
}: {
  fields: ProfileField[];
  values: Map<string, string | null>;
  client?: { full_name: string | null; email: string | null; phone: string | null };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FieldWrapper label="Nome completo" required>
        <Input name="full_name" defaultValue={client?.full_name ?? ""} required maxLength={120} />
      </FieldWrapper>
      <FieldWrapper label="E-mail" required>
        <Input name="email" type="email" defaultValue={client?.email ?? ""} required />
      </FieldWrapper>
      <FieldWrapper label="WhatsApp" full>
        <MaskedInput mask="phone" name="phone" type="tel" defaultValue={telefoneLocal(client?.phone)} placeholder="(00) 00000-0000" />
      </FieldWrapper>
      <ProfileFieldInputs fields={fields} values={values} />
    </div>
  );
}
