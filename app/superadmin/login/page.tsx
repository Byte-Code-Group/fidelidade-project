import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { superSignIn } from "../actions";

// Login do Super Admin (apex: lvh.me:3000/superadmin/login).
// Fora do route group (panel) → não passa pelo guard.
export default async function SuperLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
            <Input
              name="password"
              type="password"
              required
              placeholder="Senha"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
