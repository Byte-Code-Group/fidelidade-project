import Link from "next/link";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthShell } from "@/components/auth-shell";
import { getAuthUser } from "@/lib/supabase/server";
import { platformSignIn } from "../actions";
import { FlashToast } from "@/components/flash-toast";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getAuthUser();
  if (user) redirect("/painel");

  const { error } = await searchParams;

  return (
    <AuthShell
      title="Entrar na sua conta"
      subtitle="Acesse seu portal de fidelidade."
    >
      {/* Falha de login vira toast — a query string some depois de exibida. */}
      <FlashToast error={error} />

      <form action={platformSignIn} className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[13px] font-semibold text-gray-700">
            E-mail
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="voce@email.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="password" className="text-[13px] font-semibold text-gray-700">
              Senha
            </label>
            <Link
              href="/conta/esqueci-senha"
              className="text-[13px] font-medium text-blue-600 hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>

        <SubmitButton
          pendingLabel="Entrando…"
          className="mt-1 w-full rounded-lg bg-blue-600 py-3.5 text-[15px] font-semibold text-white hover:bg-blue-700"
        >
          Entrar
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-gray-500">
        Não tem conta?{" "}
        <Link href="/conta/cadastro" className="font-semibold text-blue-600 hover:underline">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  );
}
