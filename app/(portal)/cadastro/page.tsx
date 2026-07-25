import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { getCurrentTenant } from "@/lib/tenant";
import { signUp } from "../actions";
import { FormError } from "@/components/ui/form-alert";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await getCurrentTenant();
  const { error } = await searchParams;

  return (
    <Card>
      <CardContent>
        <h1 className="text-xl font-semibold">
          Criar conta{ctx ? ` · ${ctx.tenant.name}` : ""}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          Cadastre-se para acessar seu programa de fidelidade.
        </p>

        <form action={signUp} className="mt-5 space-y-3">
          <Input
            name="full_name"
            type="text"
            required
            placeholder="Nome completo"
            autoComplete="name"
          />
          <Input
            name="email"
            type="email"
            required
            placeholder="E-mail"
            autoComplete="email"
          />
          <PasswordInput
            name="password"
            required
            placeholder="Senha (mínimo 6 caracteres)"
            autoComplete="new-password"
          />
          <FormError error={error} />
          <Button type="submit" className="w-full">
            Criar conta
          </Button>
        </form>

        <p className="mt-4 text-center text-sm opacity-60">
          Já tem conta?{" "}
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
