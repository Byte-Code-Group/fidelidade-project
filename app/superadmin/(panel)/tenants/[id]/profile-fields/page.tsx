import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileField } from "@/lib/types";
import {
  createProfileField,
  updateProfileField,
  deleteProfileField,
} from "../../../../actions";

const FIELD_TYPES = [
  ["text", "Texto"],
  ["date", "Data"],
  ["select", "Seleção"],
  ["textarea", "Texto longo"],
] as const;

export default async function ProfileFieldsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: fields } = await db
    .from("profile_fields")
    .select("*")
    .eq("tenant_id", id)
    .order("display_order", { ascending: true })
    .returns<ProfileField[]>();

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        Campos extras que aparecem no formulário de perfil do cliente. Os campos
        padrão (nome e e-mail) são sempre exibidos.
      </p>

      {(fields ?? []).map((f) => (
        <Card key={f.id}>
          <CardContent className="space-y-3">
            <form
              action={updateProfileField.bind(null, id, f.id)}
              className="space-y-3"
            >
              <FieldForm field={f} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form action={deleteProfileField.bind(null, id, f.id)}>
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Excluir campo
              </button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent>
          <h2 className="mb-3 font-semibold">Novo campo</h2>
          <form action={createProfileField.bind(null, id)} className="space-y-3">
            <FieldForm />
            <div className="flex justify-end">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldForm({ field }: { field?: ProfileField }) {
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
        label="Opções"
        hint="apenas para tipo Seleção — uma por linha"
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
