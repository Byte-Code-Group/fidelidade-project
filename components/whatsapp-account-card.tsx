"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/section";

interface Conta {
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string | null;
  verifiedName: string | null;
  connectedAt: string;
  webhookUrl: string | null;
  verifyToken: string;
}

// Conexão do número de WhatsApp DO NEGÓCIO no Cloud API da Meta. O token sai
// daqui direto pro servidor e volta só como "conectado como X"; nunca é
// devolvido pro browser (ver lib/tenant-whatsapp.ts).
export function WhatsAppAccountCard({
  conta,
  conectarAction,
  desconectarAction,
}: {
  conta: Conta | null;
  conectarAction: (entrada: {
    accessToken: string;
    phoneNumberId: string;
    wabaId: string;
  }) => Promise<{ error?: string; displayPhone?: string; aviso?: string }>;
  desconectarAction: () => Promise<{ error?: string }>;
}) {
  const [editando, setEditando] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [pendente, iniciar] = useTransition();

  const conectar = () =>
    iniciar(async () => {
      const r = await conectarAction({ accessToken, phoneNumberId, wabaId });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        r.aviso
          ? `Número conectado — ${r.aviso}.`
          : `Número conectado${r.displayPhone ? `: ${r.displayPhone}` : ""}.`,
      );
      setAccessToken("");
      setPhoneNumberId("");
      setWabaId("");
      setEditando(false);
    });

  const desconectar = () =>
    iniciar(async () => {
      const r = await desconectarAction();
      if (r.error) toast.error(r.error);
      else toast.success("Número desconectado.");
    });

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h2 className="font-semibold">WhatsApp do seu negócio</h2>
          <p className="text-xs text-gray-500">
            Conecte o número no WhatsApp Cloud API (Meta) para disparar
            campanhas. As mensagens saem do seu número e a Meta cobra na sua
            conta — a plataforma não fica no meio do caminho.
          </p>
        </div>

        {conta && !editando ? (
          <>
            <div className="rounded-xl border border-black/10 px-3 py-2.5 text-sm dark:border-white/10">
              <p className="font-medium text-green-600">
                Conectado{conta.displayPhone ? ` — ${conta.displayPhone}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {conta.verifiedName ? `${conta.verifiedName} · ` : ""}
                desde {new Date(conta.connectedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>

            <details className="rounded-xl border border-black/10 px-3 py-2 dark:border-white/10">
              <summary className="cursor-pointer text-sm font-medium">
                Receber status de entrega e respostas
              </summary>
              <div className="mt-2 space-y-2">
                <p className="text-xs text-gray-500">
                  No painel da Meta, em{" "}
                  <strong>WhatsApp &rarr; Configuração &rarr; Webhooks</strong>,
                  cadastre o endereço abaixo e assine os campos{" "}
                  <strong>messages</strong>. Sem isso as mensagens saem, mas você
                  não vê quem recebeu nem quem respondeu.
                </p>
                <CampoCopiavel rotulo="URL de callback" valor={conta.webhookUrl ?? "—"} />
                <CampoCopiavel rotulo="Token de verificação" valor={conta.verifyToken} />
              </div>
            </details>

            <div className="flex gap-2">
              <Button
                type="button"
                className="px-3 py-1.5 text-xs"
                onClick={() => setEditando(true)}
              >
                Trocar credenciais
              </Button>
              <button
                type="button"
                onClick={desconectar}
                disabled={pendente}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                {pendente ? "Desconectando…" : "Desconectar"}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <ol className="list-decimal space-y-1 pl-4 text-xs text-gray-500 [&_strong]:font-semibold [&_strong]:text-gray-700 dark:[&_strong]:text-gray-300">
              <li>
                Em <strong>developers.facebook.com</strong>, abra seu app e vá em{" "}
                <strong>WhatsApp &rarr; Configuração da API</strong>.
              </li>
              <li>
                Copie o <strong>Phone number ID</strong> e o{" "}
                <strong>WhatsApp Business Account ID</strong>.
              </li>
              <li>
                Em <strong>Configurações do negócio &rarr; Usuários do sistema</strong>,
                gere um <strong>token permanente</strong> com as permissões{" "}
                <strong>whatsapp_business_messaging</strong> e{" "}
                <strong>whatsapp_business_management</strong>. O token temporário
                de 24h serve só pra testar.
              </li>
            </ol>

            <Field label="Token permanente">
              <Input
                type="password"
                autoComplete="off"
                placeholder="EAAG…"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone number ID">
                <Input
                  inputMode="numeric"
                  placeholder="123456789012345"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                />
              </Field>
              <Field label="WhatsApp Business Account ID">
                <Input
                  inputMode="numeric"
                  placeholder="987654321098765"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={conectar} disabled={pendente}>
                {pendente ? "Conectando…" : "Conectar número"}
              </Button>
              {conta && (
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CampoCopiavel({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs font-medium">{rotulo}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-black/5 px-2 py-1.5 text-xs dark:bg-white/10">
          {valor}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(valor);
            toast.success("Copiado.");
          }}
          className="shrink-0 text-xs text-[var(--primary)] hover:underline"
        >
          Copiar
        </button>
      </div>
    </div>
  );
}
