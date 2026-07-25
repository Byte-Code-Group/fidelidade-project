import Link from "next/link";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Logo } from "@/components/logo";
import { getAuthUser } from "@/lib/supabase/server";
import { platformSignIn } from "../actions";
import { FormError } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; expirado?: string }>;
}) {
  const user = await getAuthUser();
  if (user) redirect("/painel");

  const { error, expirado } = await searchParams;

  return (
    // fixed inset-0 → tela cheia, escapa do nav/limite do (platform)/layout.
    <div className="fixed inset-0 z-50 grid grid-cols-1 bg-white md:grid-cols-2">
      {/* Painel de marca (esquerda) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-blue-600 p-12 text-white md:flex">
        <div className="pointer-events-none absolute -right-44 -top-44 h-[480px] w-[480px] rounded-full border border-white/25" />
        <div className="pointer-events-none absolute -bottom-36 -left-24 h-[340px] w-[340px] rounded-full border border-white/25" />

        <div className="relative z-10 flex items-center gap-2.5">
          <Logo className="h-6 w-6 text-white" />
          <span className="text-xl font-extrabold">Fideliza</span>
        </div>

        <div className="relative z-10 max-w-sm">
          <h2 className="text-3xl font-extrabold leading-tight">
            Fidelize seus clientes em minutos
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/85">
            Carteirinha digital, pontos e recompensas em um só portal com a cara
            do seu negócio.
          </p>
        </div>

        <p className="relative z-10 text-[13px] text-white/70">
          © {new Date().getFullYear()} Fideliza
        </p>
      </div>

      {/* Formulário (direita) */}
      <div className="flex items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-sm flex-col gap-7">
          {/* Logo topo só no mobile (painel de marca fica oculto) */}
          <div className="flex items-center gap-2.5 text-gray-900 md:hidden">
            <Logo className="h-6 w-6" />
            <span className="text-xl font-extrabold">Fideliza</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Entrar na sua conta</h1>
            <p className="mt-2 text-sm text-gray-500">
              Acesse seu portal de fidelidade.
            </p>
          </div>

          <FormError error={error} expirado={expirado} />

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
              <label htmlFor="password" className="text-[13px] font-semibold text-gray-700">
                Senha
              </label>
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
        </div>
      </div>
    </div>
  );
}
