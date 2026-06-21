import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AguardandoPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/conta/login");

  const { modo } = await searchParams;

  // Check if tenant is already active — redirect to painel
  const db = createAdminClient();
  const { data: pu } = await db
    .from("platform_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle<{ tenant_id: string | null }>();

  if (pu?.tenant_id) {
    const { data: tenant } = await db
      .from("tenants")
      .select("status")
      .eq("id", pu.tenant_id)
      .maybeSingle<{ status: string }>();

    if (tenant?.status === "active") redirect("/painel");
  }

  return (
    <Card>
      <CardContent className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 text-2xl">
          ⏳
        </div>
        <h1 className="text-xl font-bold">Aguardando confirmação</h1>
        <p className="mt-2 text-sm text-gray-500">
          {modo === "sem_asaas"
            ? "Pagamento em processamento. Entraremos em contato para confirmar sua assinatura."
            : "Assim que o pagamento for confirmado, seu portal será ativado automaticamente. Verifique seu e-mail."}
        </p>
        <div className="mt-6 space-y-3">
          <Link href="/conta/aguardando" className="block">
            <Button className="w-full" variant="outline">
              Verificar status
            </Button>
          </Link>
          <Link href="/conta/planos" className="block text-sm text-gray-400 hover:underline">
            Voltar aos planos
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
