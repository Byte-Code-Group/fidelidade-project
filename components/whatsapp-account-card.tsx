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
  provider: "meta" | "evolution";
  phoneNumberId: string | null;
  wabaId: string | null;
  instanceName: string | null;
  displayPhone: string | null;
  verifiedName: string | null;
  connectedAt: string;
  webhookUrl: string | null;
  verifyToken: string;
}

/** Ações da conexão por QR code. Ausente = instalação sem servidor Evolution. */
export interface QrCodeConfig {
  iniciarAction: () => Promise<{
    error?: string;
    qrCode?: string | null;
    jaConectado?: boolean;
  }>;
  checarAction: () => Promise<{
    error?: string;
    conectado?: boolean;
    displayPhone?: string | null;
  }>;
}

/** De quanto em quanto tempo o painel pergunta se o QR já foi lido. */
const INTERVALO_CHECAGEM_MS = 3_000;

// Conexão do número de WhatsApp DO NEGÓCIO no Cloud API da Meta. O token sai
// daqui direto pro servidor e volta só como "conectado como X"; nunca é
// devolvido pro browser (ver lib/tenant-whatsapp.ts).
export function WhatsAppAccountCard({
  conta,
  embeddedSignup,
  qrCode,
  conectarAction,
  onboardAction,
  desconectarAction,
}: {
  conta: Conta | null;
  /** Ausente = plataforma ainda não aprovada como Tech Provider; só manual. */
  embeddedSignup?: EmbeddedSignupConfig;
  qrCode?: QrCodeConfig;
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

  // ---------- Conexão por QR code ----------
  const [imagemQr, setImagemQr] = useState<string | null>(null);
  const [lendoQr, setLendoQr] = useState(false);

  const abrirQrCode = () =>
    iniciar(async () => {
      if (!qrCode) return;
      const r = await qrCode.iniciarAction();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.jaConectado) {
        // Sessão já estava aberta no servidor (o dono conectou noutra aba):
        // só falta gravar do nosso lado.
        const c = await qrCode.checarAction();
        if (c.conectado) toast.success("Número conectado.");
        return;
      }
      if (!r.qrCode) {
        toast.error("Não consegui gerar o QR code. Tente de novo.");
        return;
      }
      setImagemQr(r.qrCode);
      setLendoQr(true);
    });

  const cancelarQrCode = () => {
    setLendoQr(false);
    setImagemQr(null);
  };

  // Enquanto o código está na tela, pergunta ao servidor se já foi lido. É o
  // único jeito: quem sabe da leitura é o WhatsApp, não o browser.
  useEffect(() => {
    if (!lendoQr || !qrCode) return;

    let vivo = true;
    const timer = setInterval(async () => {
      const r = await qrCode.checarAction();
      if (!vivo) return;

      if (r.error) {
        setLendoQr(false);
        setImagemQr(null);
        toast.error(r.error);
        return;
      }
      if (r.conectado) {
        setLendoQr(false);
        setImagemQr(null);
        toast.success(
          `Número conectado${r.displayPhone ? `: +${r.displayPhone}` : ""}.`,
        );
      }
    }, INTERVALO_CHECAGEM_MS);

    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, [lendoQr, qrCode]);

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
                {conta.provider === "evolution"
                  ? "conectado por QR code"
                  : "API oficial da Meta"}{" "}
                · desde {new Date(conta.connectedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>

            {conta.provider === "evolution" && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Nessa forma de conexão as mensagens saem pela sessão do seu
                próprio WhatsApp. Evite disparos grandes para quem não espera
                seu contato: o WhatsApp pode bloquear o número.
              </p>
            )}

            {/* Só o caminho da Meta tem webhook manual — e na conexão em 1
                clique a inscrição é automática. */}
            {conta.provider === "meta" && !embeddedSignup && (
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
            {qrCode && lendoQr && imagemQr && (
              <div className="space-y-2 rounded-xl border border-black/10 p-3 text-center dark:border-white/10">
                <p className="text-sm font-medium">Leia o código no celular</p>
                {/* Imagem vem como data URI do próprio servidor; next/image não
                    acrescenta nada aqui. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagemQr}
                  alt="QR code para conectar o WhatsApp"
                  className="mx-auto h-56 w-56 rounded-lg bg-white p-2"
                />
                <p className="text-xs text-gray-500">
                  No WhatsApp do celular: <strong>Configurações</strong> &rarr;{" "}
                  <strong>Dispositivos conectados</strong> &rarr;{" "}
                  <strong>Conectar dispositivo</strong>. O código expira em
                  segundos — se falhar, gere outro.
                </p>
                <div className="flex justify-center gap-2">
                  <Button
                    type="button"
                    className="px-3 py-1.5 text-xs"
                    onClick={abrirQrCode}
                    disabled={pendente}
                  >
                    Gerar outro código
                  </Button>
                  <button
                    type="button"
                    onClick={cancelarQrCode}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {qrCode && !lendoQr && (
              <div className="space-y-2 rounded-xl border border-black/10 p-3 dark:border-white/10">
                <p className="text-sm font-medium">Conectar por QR code</p>
                <p className="text-xs text-gray-500">
                  Igual ao WhatsApp Web: você lê um código com o celular e
                  pronto. Seu número continua funcionando normalmente no
                  aparelho, e não há custo por mensagem.
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Atenção: essa forma de conexão não é oficial do WhatsApp.
                  Disparo em massa para quem não espera seu contato pode fazer o
                  número ser bloqueado.
                </p>
                <Button type="button" onClick={abrirQrCode} disabled={pendente}>
                  {pendente ? "Gerando…" : "Gerar QR code"}
                </Button>
              </div>
            )}

            {embeddedSignup && !lendoQr && (
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

            {!lendoQr && (
            <ConexaoManual recolhida={!!qrCode}>
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
            </ConexaoManual>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * A conexão manual pela Meta é longa e técnica. Quando existe o caminho por QR
 * code ela vira o plano B e fica recolhida; sem QR code, é a única opção e
 * aparece aberta.
 */
function ConexaoManual({
  recolhida,
  children,
}: {
  recolhida: boolean;
  children: React.ReactNode;
}) {
  if (!recolhida) return <div className="space-y-3">{children}</div>;
  return (
    <details className="rounded-xl border border-black/10 px-3 py-2 dark:border-white/10">
      <summary className="cursor-pointer text-sm font-medium">
        Conectar pela API oficial da Meta
      </summary>
      <p className="mt-1 text-xs text-gray-500">
        Caminho oficial e sem risco de bloqueio, mas exige conta de
        desenvolvedor na Meta, CNPJ verificado e mensagens aprovadas
        previamente. A Meta cobra por mensagem enviada.
      </p>
      <div className="mt-2 space-y-3">{children}</div>
    </details>
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
