import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { platformSignIn } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold">Entrar na sua conta</h1>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {decodeURIComponent(error)}
            </p>
          )}

          <form action={platformSignIn} className="mt-6 space-y-4">
            <Input name="email" type="email" required placeholder="E-mail" autoComplete="email" />
            <PasswordInput
              name="password"
              required
              placeholder="Senha"
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Não tem conta?{" "}
            <Link href="/conta/cadastro" className="text-blue-600 hover:underline">
              Criar conta grátis
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
