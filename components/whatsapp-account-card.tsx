"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Script from "next/script";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/section";

// Só o pedaço do SDK do Facebook que a gente usa.
interface FacebookSdk {
  init(opts: {
    appId: string;
    autoLogAppEvents?: boolean;
    xfbml?: boolean;
    version: string;
  }): void;
  login(
    cb: (resposta: { authResponse?: { code?: string } | null }) => void,
    opts: {
      config_id: string;
      response_type: string;
      override_default_response_type: boolean;
      extras: { setup: Record<string, unknown> };
    },
  ): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

/** IDs que o popup da Meta devolve pelo evento `message`. */
interface SessaoDoPopup {
  wabaId: string;
  phoneNumberId: string;
}

export interface EmbeddedSignupConfig {
  appId: string;
  configId: string;
}

const VERSAO_SDK = "v22.0";

// A Meta só posta o resultado a partir desses domínios — mensagem de qualquer
// outra origem é ignorada.
const ORIGENS_DA_META = new Set([
  "https://www.facebook.com",
  "https://web.facebook.com",
  "https://business.facebook.com",
]);

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
  embeddedSignup,
  conectarAction,
  onboardAction,
  desconectarAction,
}: {
  conta: Conta | null;
  /** Ausente = plataforma ainda não aprovada como Tech Provider; só manual. */
  embeddedSignup?: EmbeddedSignupConfig;
  conectarAction: (entrada: {
    accessToken: string;
    phoneNumberId: string;
    wabaId: string;
  }) => Promise<{ error?: string; displayPhone?: string; aviso?: string }>;
  onboardAction: (entrada: {
    code: string;
    phoneNumberId: string;
    wabaId: string;
    pin?: string;
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

  // ---------- Embedded Signup ----------
  const [pin, setPin] = useState("");
  const [sdkPronto, setSdkPronto] = useState(false);
  // Os IDs chegam pelo evento `message`, o code chega pelo callback do
  // FB.login — em ordem não garantida. Guarda em ref pra juntar os dois.
  const sessaoRef = useRef<SessaoDoPopup | null>(null);

  useEffect(() => {
    if (!embeddedSignup) return;

    function aoReceberMensagem(evento: MessageEvent) {
      if (!ORIGENS_DA_META.has(evento.origin)) return;
      let payload: {
        type?: string;
        event?: string;
        data?: { waba_id?: string; phone_number_id?: string };
      };
      try {
        payload = typeof evento.data === "string" ? JSON.parse(evento.data) : evento.data;
      } catch {
        return;
      }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;

      if (payload.event === "ERROR") {
        sessaoRef.current = null;
        toast.error("A Meta interrompeu a conexão. Tente de novo.");
        return;
      }
      const { waba_id, phone_number_id } = payload.data ?? {};
      // FINISH_ONLY_WABA termina sem número: dá pra criar a conta, mas não
      // dá pra enviar. Não adianta salvar uma conexão que não envia.
      if (!waba_id || !phone_number_id) return;
      sessaoRef.current = { wabaId: waba_id, phoneNumberId: phone_number_id };
    }

    window.addEventListener("message", aoReceberMensagem);
    return () => window.removeEventListener("message", aoReceberMensagem);
  }, [embeddedSignup]);

  const conectarEmUmClique = () => {
    if (!embeddedSignup || !window.FB) return;
    sessaoRef.current = null;

    window.FB.login(
      (resposta) => {
        const code = resposta.authResponse?.code;
        const sessao = sessaoRef.current;
        if (!code || !sessao) {
          // Fechou o popup no meio, ou terminou sem cadastrar número.
          toast.error("Conexão não concluída. Refaça o cadastro do número até o fim.");
          return;
        }
        iniciar(async () => {
          const r = await onboardAction({
            code,
            wabaId: sessao.wabaId,
            phoneNumberId: sessao.phoneNumberId,
            pin: pin.trim() || undefined,
          });
          if (r.error) {
            toast.error(r.error);
            return;
          }
          toast.success(
            r.aviso
              ? `Número conectado — ${r.aviso}.`
              : `Número conectado${r.displayPhone ? `: ${r.displayPhone}` : ""}.`,
          );
          setPin("");
          setEditando(false);
        });
      },
      {
        config_id: embeddedSignup.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {} },
      },
    );
  };

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

            {/* Na conexão em 1 clique a inscrição do webhook é automática —
                mostrar campo pra copiar só confundiria. */}
            {!embeddedSignup && (
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
            )}

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
            {embeddedSignup && (
              <>
                {/* Carrega o SDK só quando a conexão em 1 clique está ligada. */}
                <Script
                  src="https://connect.facebook.net/en_US/sdk.js"
                  strategy="lazyOnload"
                  onReady={() => {
                    window.FB?.init({
                      appId: embeddedSignup.appId,
                      autoLogAppEvents: true,
                      xfbml: false,
                      version: VERSAO_SDK,
                    });
                    setSdkPronto(true);
                  }}
                />

                <div className="space-y-2 rounded-xl border border-black/10 p-3 dark:border-white/10">
                  <p className="text-sm font-medium">Conexão em 1 clique</p>
                  <p className="text-xs text-gray-500">
                    Abre uma janela da Meta onde você cadastra o número, recebe o
                    código por SMS e escolhe o nome de exibição. Você não precisa
                    criar app nem copiar nenhum código.
                  </p>

                  <Field
                    label="PIN de 6 dígitos"
                    hint="o que você definir na janela da Meta"
                  >
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    />
                  </Field>
                  <p className="text-xs text-gray-500">
                    Preencha antes de clicar. É com ele que o número é liberado
                    pra enviar — sem o PIN a conexão salva, mas o disparo falha.
                  </p>

                  <Button
                    type="button"
                    onClick={conectarEmUmClique}
                    disabled={pendente || !sdkPronto}
                  >
                    {pendente
                      ? "Conectando…"
                      : sdkPronto
                        ? "Conectar WhatsApp"
                        : "Carregando…"}
                  </Button>
                </div>

                <p className="text-xs text-gray-500">
                  Já tem uma conta de WhatsApp Business API própria? Use a conexão
                  manual abaixo.
                </p>
              </>
            )}

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
