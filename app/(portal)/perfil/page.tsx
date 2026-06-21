import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "@/lib/types";
import { saveProfile } from "../actions";

interface ProfileField {
  id: string;
  label: string;
  field_key: string;
  field_type: "text" | "date" | "select" | "textarea";
  options: string[] | null;
  required: boolean;
  display_order: number;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function PerfilPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();
  const { settings } = ctx;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: membership }, { data: fields }, { data: values }] =
    await Promise.all([
      supabase
        .from("users")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle<{ full_name: string | null; email: string | null }>(),
      supabase
        .from("memberships")
        .select("modality")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<Pick<Membership, "modality">>(),
      supabase
        .from("profile_fields")
        .select("*")
        .order("display_order", { ascending: true })
        .returns<ProfileField[]>(),
      supabase
        .from("profile_field_values")
        .select("field_id, value")
        .eq("user_id", user.id)
        .returns<{ field_id: string; value: string | null }[]>(),
    ]);

  const valueByField = new Map((values ?? []).map((v) => [v.field_id, v.value]));
  const memberName = profile?.full_name ?? profile?.email ?? "Membro";
  const modalityLabel =
    membership?.modality === "dependente" ? "Dependente" : "Titular";

  return (
    <div>
      <PageHeader title="Perfil" subtitle="Gerencie seus dados e preferências." />

      {/* Resumo */}
      <Card className="mb-5">
        <CardContent className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-[var(--primary-foreground)]"
            style={{ background: "var(--primary)" }}
          >
            {initials(memberName)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{memberName}</h2>
            <p className="truncate text-sm text-[var(--primary)]">
              {profile?.email}
            </p>
          </div>
          <Badge className="bg-green-500/15 text-green-600">
            {settings.label_client} · {modalityLabel}
          </Badge>
        </CardContent>
      </Card>

      {/* Formulário */}
      <form action={saveProfile}>
        <Card>
          <CardContent className="space-y-5">
            <h3 className="font-semibold">Dados do cadastro</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldWrapper label="Nome completo" required>
                <Input
                  name="full_name"
                  defaultValue={profile?.full_name ?? ""}
                  placeholder="Seu nome"
                />
              </FieldWrapper>

              <FieldWrapper label="E-mail">
                <Input defaultValue={profile?.email ?? ""} disabled />
              </FieldWrapper>

              {(fields ?? []).map((field) => {
                const value = valueByField.get(field.id) ?? "";
                const name = `field_${field.id}`;
                return (
                  <FieldWrapper
                    key={field.id}
                    label={field.label}
                    required={field.required}
                    full={field.field_type === "textarea"}
                  >
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
                    ) : (
                      <Input
                        name={name}
                        type={field.field_type === "date" ? "date" : "text"}
                        defaultValue={value}
                        required={field.required}
                      />
                    )}
                  </FieldWrapper>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button type="submit">Salvar alterações</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function FieldWrapper({
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
