import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODULES, getTemplate } from "@/lib/segment-templates";
import type { Tenant, TenantSettings } from "@/lib/types";
import {
  updateTenantCore,
  updateTenantSettings,
  uploadLogo,
  activateTenantBilling,
  cancelTenantBilling,
} from "../../../actions";
import { CustomizationForm } from "@/components/customization-form";
import { FlashToast } from "@/components/flash-toast";
import { getSubscription } from "@/lib/asaas";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000";

export default async function EditTenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle<Tenant>();
  if (!tenant) notFound();

  // Fetch subscription status from Asaas if exists
  let subscription: { status: string; nextDueDate: string; value: number } | null = null;
  if (tenant.asaas_subscription_id && process.env.ASAAS_API_KEY) {
    try {
      subscription = await getSubscription(tenant.asaas_subscription_id);
    } catch {
      // ignore — Asaas offline or invalid ID
    }
  }

  const { data: settings } = await db
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", id)
    .maybeSingle<TenantSettings>();
  if (!settings) notFound();

  // Teto do template: só estes módulos podem ser ativados nesta empresa.
  const tpl = getTemplate(tenant.segment_template);
  const allowedModules = MODULES.filter((m) =>
    tpl.modules.includes(m.key),
  ).map((m) => ({ key: m.key as string, label: m.label }));

  return (
    <div className="space-y-5">
      <FlashToast error={error} saved={saved} successMessage="Alterações salvas." />

      {/* ---------- Dados da conta ---------- */}
      <Section title="Conta">
        <form
          action={updateTenantCore.bind(null, id)}
          className="grid grid-cols-2 gap-4"
        >
          <Field label="Nome" hint={`subdomínio: ${tenant.slug}.${ROOT_DOMAIN}`}>
            <Input name="name" defaultValue={tenant.name} required />
          </Field>
          <Field label="E-mail do responsável" hint="usado no billing">
            <Input
              name="owner_email"
              type="email"
              defaultValue={tenant.owner_email ?? ""}
              placeholder="dono@empresa.com.br"
            />
          </Field>
          <Field label="CPF / CNPJ do responsável" hint="obrigatório no Asaas">
            <Input
              name="owner_cpf_cnpj"
              defaultValue={tenant.owner_cpf_cnpj ?? ""}
              placeholder="00.000.000/0001-00"
            />
          </Field>
          <Field
            label="Domínio próprio"
            hint={tenant.custom_domain ? "✓ configurado" : "opcional"}
          >
            <Input
              name="custom_domain"
              defaultValue={tenant.custom_domain ?? ""}
              placeholder="fidelidade.suaempresa.com.br"
            />
            {tenant.custom_domain ? (
              <CustomDomainInstructions domain={tenant.custom_domain} />
            ) : (
              <p className="mt-1 text-xs opacity-50">
                Use um subdomínio do cliente, ex:{" "}
                <code className="font-mono">fidelidade.oraldents.com.br</code>.
                Evite o domínio raiz (sem subdomínio).
              </p>
            )}
          </Field>
          <Field label="Plano SaaS">
            <Select name="saas_plan" defaultValue={tenant.saas_plan}>
              <option value="starter">Starter — R$ 97/mês</option>
              <option value="pro">Pro — R$ 297/mês</option>
              <option value="premium">Premium — R$ 697/mês</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={tenant.status}>
              <option value="pending">Aguardando pagamento</option>
              <option value="active">Ativo</option>
              <option value="suspended">Suspenso</option>
            </Select>
          </Field>
          <div className="col-span-2">
            <Button type="submit" pendingLabel="Salvando…">Salvar conta</Button>
          </div>
        </form>
      </Section>

      {/* ---------- Billing Asaas ---------- */}
      <Section title="Billing">
        {subscription ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="opacity-50">Status</p>
                <p className="font-medium capitalize">{subscription.status}</p>
              </div>
              <div>
                <p className="opacity-50">Próximo vencimento</p>
                <p className="font-medium">{subscription.nextDueDate}</p>
              </div>
              <div>
                <p className="opacity-50">Valor</p>
                <p className="font-medium">
                  {subscription.value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                  /mês
                </p>
              </div>
            </div>
            <form action={cancelTenantBilling.bind(null, id)}>
              <Button type="submit" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                Cancelar assinatura
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm opacity-60">
              {tenant.asaas_subscription_id
                ? "Assinatura encontrada, mas ASAAS_API_KEY não está configurada neste ambiente."
                : "Nenhuma assinatura ativa. Ative o billing para cobrar automaticamente via Pix."}
            </p>
            {!tenant.asaas_subscription_id && (
              <form action={activateTenantBilling.bind(null, id)} className="flex items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs opacity-50">Forma de cobrança</label>
                  <Select name="billing_type" defaultValue="PIX">
                    <option value="PIX">PIX (gerado mensalmente)</option>
                    <option value="BOLETO">Boleto bancário</option>
                  </Select>
                </div>
                <Button type="submit" disabled={!tenant.owner_email || !tenant.owner_cpf_cnpj}>
                  Criar assinatura
                </Button>
              </form>
            )}
          </div>
        )}
      </Section>

      {/* ---------- Customização com preview ao vivo ---------- */}
      <CustomizationForm
        tenantName={tenant.name}
        templateLabel={tpl.label}
        templateEmoji={tpl.emoji}
        templateHref={`/superadmin/templates/${tenant.segment_template}`}
        portalUrl={tenant.custom_domain ? `https://${tenant.custom_domain}` : `/p/${tenant.slug}`}
        settings={settings}
        allowedModules={allowedModules}
        saveAction={updateTenantSettings.bind(null, id)}
        uploadAction={uploadLogo.bind(null, id)}
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({
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

function CustomDomainInstructions({ domain }: { domain: string }) {
  const parts = domain.split(".");
  // subdomínio: "fidelidade.oraldents.com.br" → nome = "fidelidade"
  // domínio raiz: "oraldents.com.br" → CNAME no apex não é suportado (avisa)
  const isApex = parts.length <= 2 || (parts.length === 3 && parts[1].length === 2);
  const cnameHost = isApex ? null : parts[0];

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🌐</span>
        <p className="font-semibold">Configuração do domínio próprio</p>
      </div>

      {isApex ? (
        <div className="rounded-md bg-amber-100 border border-amber-200 px-3 py-2 text-amber-800 text-xs">
          ⚠️ <strong>{domain}</strong> é um domínio raiz. CNAME no apex não é suportado pela maioria dos registradores. Use um subdomínio, ex:{" "}
          <code className="font-mono">fidelidade.{domain}</code>.
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <p className="font-medium text-xs uppercase tracking-wide opacity-60">
              Passo 1 — Cliente: configurar DNS
            </p>
            <p className="text-xs">
              No painel DNS do domínio <code className="font-mono font-semibold">{domain}</code> (GoDaddy, Cloudflare, Registro.br etc.), adicionar o registro:
            </p>
            <div className="rounded-md bg-white dark:bg-white/5 border border-blue-100 dark:border-white/10 overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-blue-100 bg-blue-50/60">
                    <th className="text-left px-3 py-1.5 font-semibold">Tipo</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Nome / Host</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Valor / Destino</th>
                    <th className="text-left px-3 py-1.5 font-semibold">TTL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 text-blue-700 font-bold">CNAME</td>
                    <td className="px-3 py-2">{cnameHost}</td>
                    <td className="px-3 py-2">cname.vercel-dns.com</td>
                    <td className="px-3 py-2 opacity-60">3600</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs opacity-60">
              Propagação DNS pode levar até 24h, mas costuma ser minutos.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-xs uppercase tracking-wide opacity-60">
              Passo 2 — Você: adicionar na Vercel
            </p>
            <p className="text-xs">
              No projeto Vercel → <strong>Settings → Domains</strong> → adicionar{" "}
              <code className="font-mono font-semibold">{domain}</code>.
              A Vercel valida o CNAME e emite o SSL automaticamente.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-xs uppercase tracking-wide opacity-60">
              Passo 3 — Pronto
            </p>
            <p className="text-xs">
              O portal do cliente estará disponível em{" "}
              <code className="font-mono font-semibold">https://{domain}</code>{" "}
              com SSL e tema da marca automaticamente.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
