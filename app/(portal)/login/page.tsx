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
  searchParams: Promise<{ error?: string; expirado?: string }>;
}) {
  const ctx = await getCurrentTenant();
  const { error, expirado } = await searchParams;

  return (
    <Card>
      <CardContent>
        <h1 className="text-xl font-semibold">
          Entrar{ctx ? ` · ${ctx.tenant.name}` : ""}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          Acesse sua {ctx?.settings.label_client.toLowerCase() ?? "conta"}.
        </p>

        <form action={signIn} className="mt-5 space-y-3">
          <Input name="email" type="email" required placeholder="E-mail" />
          <PasswordInput
            name="password"
            required
            placeholder="Senha"
          />
          <FormError error={error} expirado={expirado} />
          <Button type="submit" className="w-full" pendingLabel="Entrando…">
            Entrar
          </Button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-1 text-sm opacity-60">
          <Link href="/esqueci-senha" className="hover:underline">
            Esqueci minha senha
          </Link>
          <span>
            Não tem conta?{" "}
            <Link href="/cadastro" className="text-[var(--primary)] hover:underline">
              Cadastre-se
            </Link>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
