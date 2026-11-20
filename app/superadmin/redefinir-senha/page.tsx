"use client";
import { Icon } from "@/components/icons";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { atualizarSenha } from "@/lib/auth-actions";
import { FormAlert } from "@/components/ui/form-alert";

export default function SuperadminRedefinirSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    setStatus("loading");
    // No servidor: valida a política de senha (inclui senha vazada) antes de gravar.
    const { error } = await atualizarSenha(password, confirm);

    if (error) {
      setErrorMsg(error);
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
              <Icon name="check" className="h-6 w-6" />
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
            <PasswordInput
              required
              placeholder="Nova senha"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordInput
              required
              placeholder="Confirmar nova senha"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errorMsg && <FormAlert>{errorMsg}</FormAlert>}
            <Button type="submit" className="w-full" disabled={status === "loading"}>
              {status === "loading" ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
