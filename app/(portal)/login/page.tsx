import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { getCurrentTenant } from "@/lib/tenant";
import { signIn } from "../actions";
import { FormError } from "@/components/ui/form-alert";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await getCurrentTenant();
  const { error } = await searchParams;

  return (
    <Card className="shadow-md">
      <CardContent className="p-6 md:p-7">
        <h1 className="text-2xl font-bold tracking-tight">
          Entrar{ctx ? ` · ${ctx.tenant.name}` : ""}
        </h1>
        <p className="mt-1.5 text-sm opacity-70">
          Acesse sua {ctx?.settings.label_client.toLowerCase() ?? "conta"}.
        </p>

        <form action={signIn} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              E-mail
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="voce@email.com"
              className="h-12 px-4 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="password" className="text-sm font-medium">
                Senha
              </label>
              <Link
                href="/esqueci-senha"
                className="text-xs text-[var(--primary)] hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="Sua senha"
              className="h-12 pl-4 text-base"
            />
          </div>

          <FormError error={error} />
          <Button
            type="submit"
            className="h-12 w-full text-base"
            pendingLabel="Entrando…"
          >
            Entrar
          </Button>
        </form>

        <p className="mt-5 text-center text-sm opacity-70">
          Não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-medium text-[var(--primary)] hover:underline"
          >
            Cadastre-se
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
