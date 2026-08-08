import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthShell } from "@/components/auth-shell";
import { FlashToast } from "@/components/flash-toast";
import { SubmitButton } from "@/components/ui/submit-button";
import { getAuthUser } from "@/lib/supabase/server";
import { updatePlatformPassword } from "../actions";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  if (ok) {
    return (
      <AuthShell
        title="Senha atualizada"
        subtitle="Sua nova senha já está valendo."
      >
        <Link
          href="/painel"
          className="w-full rounded-lg bg-blue-600 py-3.5 text-center text-[15px] font-semibold text-white hover:bg-blue-700"
        >
          Ir para o painel
        </Link>
      </AuthShell>
    );
  }

  // A sessão vem do link do e-mail (ver app/auth/recuperar/route.ts). Sem ela,
  // não há nada pra redefinir.
  const user = await getAuthUser();
  if (!user) redirect("/conta/esqueci-senha?error=link_invalido");

  return (
    <AuthShell
      title="Criar nova senha"
      subtitle="Escolha uma senha com pelo menos 6 caracteres."
    >
      <FlashToast error={error} />

      <form action={updatePlatformPassword} className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-[13px] font-semibold text-gray-700">
            Nova senha
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-[13px] font-semibold text-gray-700">
            Confirmar nova senha
          </label>
          <PasswordInput
            id="confirm"
            name="confirm"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>

        <SubmitButton
          pendingLabel="Salvando…"
          className="mt-1 w-full rounded-lg bg-blue-600 py-3.5 text-[15px] font-semibold text-white hover:bg-blue-700"
        >
          Salvar nova senha
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
