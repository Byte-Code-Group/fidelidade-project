import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentTenant } from "@/lib/tenant";
import { requestPasswordReset } from "../actions";

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const ctx = await getCurrentTenant();
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <Card>
        <CardContent className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600 text-2xl">
            ✓
          </div>
          <h1 className="text-lg font-semibold">E-mail enviado</h1>
          <p className="mt-2 text-sm opacity-70">
            Verifique sua caixa de entrada e clique no link para redefinir sua
            senha.
          </p>
          <Link href="/login" className="mt-5 block">
            <Button variant="outline" className="w-full">
              Voltar ao login
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <h1 className="text-xl font-semibold">
          Recuperar senha{ctx ? ` · ${ctx.tenant.name}` : ""}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          Informe o e-mail cadastrado e enviaremos um link de redefinição.
        </p>

        <form action={requestPasswordReset} className="mt-5 space-y-3">
          <Input
            name="email"
            type="email"
            required
            placeholder="Seu e-mail"
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
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            Voltar ao login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
