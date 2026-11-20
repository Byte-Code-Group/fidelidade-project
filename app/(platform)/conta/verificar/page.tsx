import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { MfaVerifyForm } from "@/components/mfa-verify-form";
import { getAuthUser } from "@/lib/supabase/server";
import { precisaVerificarMfa } from "@/lib/mfa";

// Segunda etapa do login do dono (quem ativou a verificação em duas etapas).
// Só destinos conhecidos: o parâmetro vem da URL.
const DESTINOS = ["/painel", "/conta/redefinir-senha"];

export default async function VerificarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const destino = next && DESTINOS.includes(next) ? next : "/painel";
  const user = await getAuthUser();
  if (!user) redirect("/conta/login");
  if (!(await precisaVerificarMfa(user))) redirect(destino);

  return (
    <AuthShell title="Verificação em duas etapas" subtitle="Digite o código de 6 dígitos do seu app autenticador.">
      <MfaVerifyForm destino={destino} loginPath="/conta/login" />
    </AuthShell>
  );
}
