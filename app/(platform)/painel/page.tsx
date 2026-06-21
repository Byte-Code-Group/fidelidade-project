import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformSignOut } from "../conta/actions";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

const STATUS_LABEL: Record<string, string> = {
  trial: "Trial",
  pending: "Aguardando pagamento",
  active: "Ativo",
  suspended: "Suspenso",
};
const STATUS_COLOR: Record<string, string> = {
  trial: "bg-yellow-100 text-yellow-700",
  pending: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-600",
};

export default async function PainelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/conta/login");

  const db = createAdminClient();
  const { data: pu } = await db
    .from("platform_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle<{ tenant_id: string | null }>();

  // No tenant yet → send to onboarding
  if (!pu?.tenant_id) redirect("/conta/configurar");

  const [{ data: tenant }, { data: settings }, { data: members }, { data: checkins }] =
    await Promise.all([
      db
        .from("tenants")
        .select("name, slug, status, saas_plan, trial_ends_at, asaas_subscription_id")
        .eq("id", pu.tenant_id)
        .maybeSingle<{
          name: string;
          slug: string;
          status: string;
          saas_plan: string;
          trial_ends_at: string | null;
          asaas_subscription_id: string | null;
        }>(),
      db
        .from("tenant_settings")
        .select("primary_color, logo_url")
        .eq("tenant_id", pu.tenant_id)
        .maybeSingle<{ primary_color: string; logo_url: string | null }>(),
      db
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", pu.tenant_id),
      db
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", pu.tenant_id),
    ]);

  if (!tenant) redirect("/conta/configurar");

  const portalUrl = `https://${ROOT_DOMAIN}/p/${tenant.slug}`;
  const isPending = tenant.status === "pending";
  const isTrial = tenant.status === "trial";
  const trialExpired =
    isTrial && tenant.trial_ends_at != null && new Date(tenant.trial_ends_at) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[tenant.status] ?? "bg-gray-100 text-gray-600"}`}
          >
            {STATUS_LABEL[tenant.status] ?? tenant.status}
          </span>
        </div>
        <form action={platformSignOut}>
          <Button type="submit" variant="outline" className="text-sm">
            Sair
          </Button>
        </form>
      </div>

      {/* Pending payment banner */}
      {isPending && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">Aguardando confirmação do pagamento</p>
          <p className="mt-1 text-sm text-blue-600">
            Seu portal será ativado automaticamente após o pagamento.{" "}
            <Link href="/conta/planos" className="underline">
              Pagar agora
            </Link>
          </p>
        </div>
      )}

      {/* Trial expiring banner */}
      {isTrial && !trialExpired && tenant.trial_ends_at && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">
            Trial gratuito expira em{" "}
            {new Date(tenant.trial_ends_at).toLocaleDateString("pt-BR")}
          </p>
          <p className="mt-1 text-sm text-yellow-600">
            <Link href="/conta/planos" className="underline">
              Assinar para continuar
            </Link>
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wider text-gray-400">Membros</p>
            <p className="mt-1 text-3xl font-bold">{members?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wider text-gray-400">Check-ins</p>
            <p className="mt-1 text-3xl font-bold">{checkins?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Portal link */}
      <Card>
        <CardContent>
          <p className="text-sm font-medium text-gray-500">Seu portal</p>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-blue-600 hover:underline text-sm break-all"
          >
            {portalUrl} ↗
          </a>
          <p className="mt-2 text-xs text-gray-400">
            Compartilhe este link com seus clientes para que eles se cadastrem.
          </p>
        </CardContent>
      </Card>

      {/* Plan + billing */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Plano</p>
              <p className="font-semibold capitalize">{tenant.saas_plan}</p>
            </div>
            {!tenant.asaas_subscription_id && !isPending && (
              <Link href="/conta/planos">
                <Button className="text-sm">Assinar</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/conta/configurar">
          <Button variant="outline" className="w-full text-sm">
            Editar negócio
          </Button>
        </Link>
        <a href={portalUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="w-full text-sm">
            Ver portal ↗
          </Button>
        </a>
      </div>
    </div>
  );
}
