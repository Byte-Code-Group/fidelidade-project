import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { MfaVerifyForm } from "@/components/mfa-verify-form";
import { getAuthUser } from "@/lib/supabase/server";
import { precisaVerificarMfa } from "@/lib/mfa";

// Segunda etapa do login do superadmin. Fora do grupo (panel), cujo guard
// mandaria de volta pra cá.
// Só destinos conhecidos: o parâmetro vem da URL.
const DESTINOS = ["/superadmin", "/superadmin/redefinir-senha"];

export default async function SuperVerificarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const destino = next && DESTINOS.includes(next) ? next : "/superadmin";
  const user = await getAuthUser();
  if (!user) redirect("/superadmin/login");
  if (!(await precisaVerificarMfa(user))) redirect(destino);

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm items-center px-5">
      <Card className="w-full">
        <CardContent>
          <h1 className="text-xl font-semibold">Verificação em duas etapas</h1>
          <p className="mb-5 mt-1 text-sm text-muted">Digite o código de 6 dígitos do seu app autenticador.</p>
          <MfaVerifyForm destino={destino} loginPath="/superadmin/login" />
        </CardContent>
      </Card>
    </div>
  );
}
