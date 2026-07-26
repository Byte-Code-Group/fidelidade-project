"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface Conta {
  environment: "sandbox" | "production";
  accountName: string | null;
  accountEmail: string | null;
  webhookId: string | null;
  connectedAt: string;
}

// Conexão da conta Asaas DO NEGÓCIO — a que recebe as assinaturas dos
// clientes dele. A chave sai daqui direto pro servidor e volta como "conectado
// como X"; nunca é devolvida pro browser (ver lib/tenant-asaas.ts).
export function AsaasAccountCard({
  conta,
  conectarAction,
  desconectarAction,
}: {
  conta: Conta | null;
  conectarAction: (
    apiKey: string,
    environment: "sandbox" | "production",
  ) => Promise<{ error?: string; accountName?: string; aviso?: string }>;
  desconectarAction: () => Promise<{ error?: string }>;
}) {
  const [editando, setEditando] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [ambiente, setAmbiente] = useState<"sandbox" | "production">(
    conta?.environment ?? "production",
  );
  const [pendente, iniciar] = useTransition();

  const conectar = () =>
    iniciar(async () => {
      const r = await conectarAction(apiKey, ambiente);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        r.aviso
          ? `Conta conectada — ${r.aviso}.`
          : `Conta conectada${r.accountName ? `: ${r.accountName}` : ""}.`,
      );
      setApiKey("");
      setEditando(false);
    });

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h2 className="font-semibold">Receber dos seus clientes (Asaas)</h2>
          <p className="text-xs text-gray-500">
            Conecte a conta Asaas do seu negócio para cobrar os planos que você
            vende no portal. O dinheiro cai direto na sua conta — a plataforma
            não fica no meio do caminho.
          </p>
        </div>

        {conta && !editando ? (
          <>
            <div className="rounded-xl border border-black/10 px-3 py-2.5 text-sm dark:border-white/10">
              <p className="font-medium text-green-600">
                Conectado{conta.accountName ? ` — ${conta.accountName}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {conta.accountEmail ? `${conta.accountEmail} · ` : ""}
                {conta.environment === "sandbox" ? "ambiente de teste (sandbox)" : "produção"}
                {" · desde "}
                {new Date(conta.connectedAt).toLocaleDateString("pt-BR")}
              </p>
              {!conta.webhookId && (
                <p className="mt-1 text-xs text-amber-600">
                  Sem webhook automático: os pagamentos entram, mas o status da
                  assinatura do cliente não atualiza sozinho. Reconecte para
                  tentar de novo.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="px-3 py-1.5 text-sm"
                onClick={() => setEditando(true)}
              >
                Trocar chave
              </Button>
              <Button
                type="button"
                variant="outline"
                className="px-3 py-1.5 text-sm"
                disabled={pendente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await desconectarAction();
                    if (r.error) toast.error(r.error);
                    else toast.success("Conta desconectada.");
                  })
                }
              >
                Desconectar
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Chave de API</span>
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
                autoComplete="off"
                placeholder="$aact_..."
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Ambiente</span>
              <Select
                value={ambiente}
                onChange={(e) =>
                  setAmbiente(e.target.value === "sandbox" ? "sandbox" : "production")
                }
              >
                <option value="production">Produção (cobrança real)</option>
                <option value="sandbox">Sandbox (teste)</option>
              </Select>
            </label>

            <p className="text-xs text-gray-500">
              A chave fica no Asaas em Configurações → Integrações → Chave de
              API. Guardamos cifrada e usamos só para criar as cobranças dos
              seus planos.
            </p>

            <div className="flex gap-2">
              <Button
                type="button"
                className="px-3 py-1.5 text-sm"
                disabled={pendente || !apiKey.trim()}
                onClick={conectar}
              >
                {pendente ? "Conectando…" : "Conectar"}
              </Button>
              {conta && (
                <Button
                  type="button"
                  variant="outline"
                  className="px-3 py-1.5 text-sm"
                  onClick={() => {
                    setEditando(false);
                    setApiKey("");
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
