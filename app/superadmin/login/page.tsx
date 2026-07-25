import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { getPlatformAdmin } from "@/lib/superadmin";
import { superSignIn } from "../actions";
import { FormError } from "@/components/ui/form-alert";

// Login do Super Admin (apex: lvh.me:3000/superadmin/login).
// Fora do route group (panel) → não passa pelo guard.
export default async function SuperLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; expirado?: string }>;
}) {
  const admin = await getPlatformAdmin();
  if (admin) redirect("/superadmin");

  const { error, expirado } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm items-center px-5">
      <Card className="w-full">
        <CardContent>
          <p className="text-xs font-medium uppercase tracking-wider opacity-50">
            Plataforma
          </p>
          <h1 className="mt-1 text-xl font-semibold">Super Admin</h1>
          <p className="mt-1 text-sm opacity-70">Acesso restrito.</p>

          <form action={superSignIn} className="mt-5 space-y-3">
            <Input name="email" type="email" required placeholder="E-mail" />
            <PasswordInput
              name="password"
              required
              placeholder="Senha"
            />
            <FormError error={error} expirado={expirado} />
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
          <p className="mt-4 text-center text-sm opacity-60">
            <Link href="/superadmin/esqueci-senha" className="hover:underline">
              Esqueci minha senha
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
