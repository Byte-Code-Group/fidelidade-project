"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function SuperadminRedefinirSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 6) {
      setErrorMsg("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("done");
    }
  }

  if (status === "done") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 dark:bg-neutral-950 px-5">
        <Card className="w-full max-w-sm">
          <CardContent className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600 text-2xl">
              ✓
            </div>
            <h1 className="text-lg font-semibold">Senha atualizada</h1>
            <p className="mt-2 text-sm opacity-70">Sua senha foi redefinida com sucesso.</p>
            <a href="/superadmin/login" className="mt-5 block">
              <Button className="w-full">Ir para o painel</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 dark:bg-neutral-950 px-5">
      <Card className="w-full max-w-sm">
        <CardContent>
          <h1 className="text-xl font-semibold">Redefinir senha</h1>
          <p className="mt-1 text-sm opacity-70">Escolha uma nova senha para o painel.</p>
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <Input
              type="password"
              required
              placeholder="Nova senha"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              type="password"
              required
              placeholder="Confirmar nova senha"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {(errorMsg || status === "error") && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}
            <Button type="submit" className="w-full" disabled={status === "loading"}>
              {status === "loading" ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
