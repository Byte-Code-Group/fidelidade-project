import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { platformSignUp } from "../actions";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Card>
      <CardContent>
        <h1 className="text-xl font-bold">Crie sua conta</h1>
        <p className="mt-1 text-sm text-gray-500">
          14 dias grátis, sem cartão de crédito.
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {decodeURIComponent(error)}
          </p>
        )}

        <form action={platformSignUp} className="mt-6 space-y-4">
          <Input name="name" required placeholder="Seu nome completo" autoComplete="name" />
          <Input name="email" type="email" required placeholder="E-mail" autoComplete="email" />
          <PasswordInput
            name="password"
            required
            placeholder="Senha (mín. 6 caracteres)"
            autoComplete="new-password"
          />
          <Button type="submit" className="w-full">
            Criar conta e continuar
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Já tem conta?{" "}
          <Link href="/conta/login" className="text-blue-600 hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
