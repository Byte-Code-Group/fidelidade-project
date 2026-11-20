"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/ui/form-alert";
import { confirmarCodigoMfa, sairDaVerificacao } from "@/lib/auth-actions";

// Segunda etapa do login: código de 6 dígitos do app autenticador.
export function MfaVerifyForm({ destino, loginPath }: { destino: string; loginPath: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const r = await confirmarCodigoMfa(code);
      if (r.error) {
        setError(r.error);
        setCode("");
        return;
      }
      router.replace(destino);
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <Input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        placeholder="000000"
        aria-label="Código de 6 dígitos"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="text-center font-mono text-2xl tracking-[0.5em]"
      />
      <FormAlert>{error}</FormAlert>
      <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
        {pending ? "Verificando…" : "Verificar"}
      </Button>
      <button
        type="button"
        onClick={() => startTransition(() => sairDaVerificacao(loginPath))}
        className="block w-full text-center text-sm text-muted hover:underline"
      >
        Entrar com outra conta
      </button>
    </form>
  );
}
