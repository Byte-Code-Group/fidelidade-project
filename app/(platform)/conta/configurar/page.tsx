import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Select } from "@/components/ui/select";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantOwner } from "@/lib/owner";
import { configureBusiness } from "../actions";
import { FormError } from "@/components/ui/form-alert";

export default async function ConfigurarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/conta/login");

  const { error, mode } = await searchParams;
  const isNew = mode === "new";

  // Pre-fill com o negócio ativo, exceto ao criar um adicional (form em branco).
  let defaults = { name: "", segment: "", cpfCnpj: "" };
  if (!isNew) {
    const db = createAdminClient();
    const owner = await getTenantOwner();
    if (owner) {
      const { data: t } = await db
        .from("tenants")
        .select("name, segment_template, owner_cpf_cnpj")
        .eq("id", owner.tenantId)
        .maybeSingle<{ name: string; segment_template: string; owner_cpf_cnpj: string | null }>();
      if (t) {
        defaults = {
          name: t.name,
          segment: t.segment_template,
          cpfCnpj: t.owner_cpf_cnpj ?? "",
        };
      }
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardContent>
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-600">
            Passo 1 de 2
          </div>
          <h1 className="text-xl font-bold">
            {isNew ? "Novo negócio" : "Sobre o seu negócio"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isNew
              ? "Cada negócio tem seu próprio portal e assinatura."
              : "Estas informações personalizam o seu portal de fidelidade."}
          </p>

          <div className="mt-3">
            <FormError error={error} />
          </div>

          <form action={configureBusiness} className="mt-6 space-y-4">
            {isNew && <input type="hidden" name="mode" value="new" />}
            <div>
              <label className="mb-1 block text-sm font-medium">Nome do negócio</label>
              <Input
                name="business_name"
                required
                placeholder="Ex: Studio Silva"
                defaultValue={defaults.name}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Segmento</label>
              <Select name="segment" defaultValue={defaults.segment || ""}>
                <option value="" disabled>Escolha o segmento</option>
                <option value="odonto">Odontologia</option>
                <option value="academia">Academia / Fitness</option>
                <option value="barbearia">Barbearia</option>
                <option value="salao">Salão de beleza</option>
                <option value="restaurante">Restaurante / Food</option>
                <option value="estetica">Estética</option>
                <option value="generico">Outro</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">CPF / CNPJ</label>
              <MaskedInput
                mask="cpf-cnpj"
                name="owner_cpf_cnpj"
                required
                placeholder="00.000.000/0001-00"
                defaultValue={defaults.cpfCnpj}
              />
              <p className="mt-1 text-xs text-gray-400">Necessário para emissão de cobranças.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">WhatsApp (opcional)</label>
              <MaskedInput mask="phone" name="phone" type="tel" placeholder="(00) 00000-0000" />
            </div>
            <Button type="submit" className="w-full" pendingLabel="Salvando…">
              Continuar →
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
