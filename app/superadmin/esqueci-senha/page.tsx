import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requestSuperadminPasswordReset } from "../actions";

export default async function SuperadminEsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 dark:bg-neutral-950 px-5">
        <Card className="w-full max-w-sm">
          <CardContent className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600 text-2xl">
              ✓
            </div>
            <h1 className="text-lg font-semibold">E-mail enviado</h1>
            <p className="mt-2 text-sm opacity-70">
              Verifique sua caixa de entrada e clique no link para redefinir sua senha.
            </p>
            <Link href="/superadmin/login" className="mt-5 block">
              <Button variant="outline" className="w-full">Voltar ao login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 dark:bg-neutral-950 px-5">
      <Card className="w-full max-w-sm">
        <CardContent>
          <h1 className="text-xl font-semibold">Recuperar senha</h1>
          <p className="mt-1 text-sm opacity-70">
            Informe o e-mail do administrador para receber o link de redefinição.
          </p>
          <form action={requestSuperadminPasswordReset} className="mt-5 space-y-3">
            <Input
              name="email"
              type="email"
              required
              placeholder="admin@plataforma.com"
              autoComplete="email"
            />
            {error && (
              <p className="text-sm text-red-600">{decodeURIComponent(error)}</p>
            )}
            <Button type="submit" className="w-full">
              Enviar link de redefinição
            </Button>
          </form>
          <p className="mt-4 text-center text-sm opacity-60">
            <Link href="/superadmin/login" className="hover:underline">
              Voltar ao login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
