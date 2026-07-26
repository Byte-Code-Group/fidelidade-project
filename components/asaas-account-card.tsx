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

const enderecoDoAsaas = (ambiente: "sandbox" | "production") =>
  ambiente === "sandbox" ? "https://sandbox.asaas.com" : "https://www.asaas.com";

function Passos({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal space-y-1 pl-4 text-xs text-gray-500 [&_strong]:font-semibold [&_strong]:text-gray-700 dark:[&_strong]:text-gray-300">
      {children}
    </ol>
  );
}

// Conexão da conta Asaas DO NEGÓCIO — a que recebe as assinaturas dos clientes
// dele. A chave sai daqui direto pro servidor e volta como "conectado como X";
// nunca é devolvida pro browser (ver lib/tenant-asaas.ts).
export function AsaasAccountCard({
  conta,
  portalUrl,
  conectarAction,
  desconectarAction,
}: {
  conta: Conta | null;
  /** Endereço do portal — é o que o Asaas pede como "site" da conta. */
  portalUrl?: string;
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

            <details className="rounded-xl border border-black/10 px-3 py-2 dark:border-white/10">
              <summary className="cursor-pointer text-sm font-medium">
                Opcional: fazer o cliente voltar ao portal depois de pagar
              </summary>
              <div className="mt-2 space-y-2">
                <p className="text-xs text-gray-500">
                  O Asaas só devolve o cliente pro portal se a sua conta tiver
                  um site cadastrado. Sem isso a cobrança funciona igual — ele
                  só não é redirecionado no fim.
                </p>
                <Passos>
                  <li>
                    Abra o{" "}
                    <a
                      href={enderecoDoAsaas(conta.environment)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--primary)] hover:underline"
                    >
                      painel do Asaas
                    </a>
                    {conta.environment === "sandbox" ? " (sandbox)" : ""}.
                  </li>
                  <li>
                    Clique no seu nome (canto superior direito) → <strong>Minha Conta</strong>.
                  </li>
                  <li>
                    Vá na aba <strong>Informações</strong>.
                  </li>
                  <li>
                    No campo de <strong>site</strong>, coloque{" "}
                    <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">
                      {portalUrl ?? "o endereço do seu portal"}
                    </code>{" "}
                    e salve.
                  </li>
                </Passos>
              </div>
            </details>

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
            <div className="rounded-xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]">
              <p className="mb-1.5 text-sm font-medium">Onde achar a chave</p>
              <Passos>
                <li>
                  Entre no{" "}
                  <a
                    href={enderecoDoAsaas(ambiente)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--primary)] hover:underline"
                  >
                    painel do Asaas
                  </a>
                  {ambiente === "sandbox"
                    ? " (sandbox — cobrança de teste, sem dinheiro real)"
                    : " com a conta que recebe o dinheiro"}
                  .
                </li>
                <li>
                  Menu lateral: <strong>Configurações</strong> →{" "}
                  <strong>Integrações</strong> → <strong>Chave de API</strong>.
                </li>
                <li>
                  Clique em <strong>Gerar chave</strong> (ou copie a que já
                  existe). Ela começa com <code>$aact_</code> e só aparece uma
                  vez.
                </li>
                <li>Cole abaixo e escolha o mesmo ambiente da conta.</li>
              </Passos>
            </div>

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
              Guardamos a chave cifrada e usamos só para criar as cobranças dos
              seus planos. Dá pra desconectar quando quiser.
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
