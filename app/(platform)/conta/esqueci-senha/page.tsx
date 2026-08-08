import Link from "next/link";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth-shell";
import { FlashToast } from "@/components/flash-toast";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPlatformPasswordReset } from "../actions";

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enviado?: string }>;
}) {
  const { error, enviado } = await searchParams;

  if (enviado) {
    return (
      <AuthShell
        title="E-mail enviado"
        subtitle="Se existir uma conta com esse endereço, o link de redefinição já está a caminho."
      >
        <div className="rounded-lg bg-blue-50 px-4 py-3.5 text-sm leading-relaxed text-blue-700">
          Verifique sua caixa de entrada (e o spam). O link vale por 1 hora e só
          pode ser usado uma vez.
        </div>

        <Link
          href="/conta/login"
          className="w-full rounded-lg bg-blue-600 py-3.5 text-center text-[15px] font-semibold text-white hover:bg-blue-700"
        >
          Voltar ao login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha."
    >
      <FlashToast error={error} />

      <form action={requestPlatformPasswordReset} className="flex flex-col gap-[18px]">
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

        <SubmitButton
          pendingLabel="Enviando…"
          className="mt-1 w-full rounded-lg bg-blue-600 py-3.5 text-[15px] font-semibold text-white hover:bg-blue-700"
        >
          Enviar link
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-gray-500">
        Lembrou a senha?{" "}
        <Link href="/conta/login" className="font-semibold text-blue-600 hover:underline">
          Voltar ao login
        </Link>
      </p>
    </AuthShell>
  );
}
