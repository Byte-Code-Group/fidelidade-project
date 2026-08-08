import "server-only";

// Cliente do WhatsApp Cloud API (Graph API da Meta). Só fala HTTP — quem
// guarda credencial é lib/tenant-whatsapp.ts e quem monta campanha é
// lib/campaigns.ts.
//
// Fora da janela de 24h (cliente falou com o número há menos de 24h) a Meta
// só aceita TEMPLATE previamente aprovado. Por isso campanha aqui é sempre
// template — não existe "mandar texto livre pra lista".

const GRAPH = "https://graph.facebook.com";

export interface CredenciaisWhatsApp {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  apiVersion: string;
}

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string; // APPROVED | PENDING | REJECTED | PAUSED | DISABLED
  category: TemplateCategory;
  /** Texto do corpo, com os {{1}}, {{2}}… como a Meta guarda. */
  body: string;
  /** Quantas variáveis o corpo espera — o envio tem que mandar exatamente isso. */
  variableCount: number;
}

interface ComponenteTemplate {
  type: string;
  text?: string;
}

interface TemplateDaMeta {
  name: string;
  language: string;
  status: string;
  category: string;
  components?: ComponenteTemplate[];
}

// ------------------------------------------------------------
// Telefone
// ------------------------------------------------------------

/**
 * Converte o telefone como o cliente digitou em E.164 sem "+", que é o
 * formato que a Meta exige ("5531999998888").
 *
 * Assume Brasil quando não vem DDI: número salvo no cadastro é "(31) 99999-8888".
 * Devolve null quando não dá pra confiar no que veio — melhor não enviar do
 * que enviar pra um desconhecido.
 */
export function normalizarE164(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let digitos = bruto.replace(/\D/g, "");

  // Já veio com DDI 55 e tamanho de celular/fixo brasileiro.
  if (digitos.startsWith("55") && (digitos.length === 13 || digitos.length === 12)) {
    return digitos;
  }
  // Local: DDD + 9 dígitos (celular) ou DDD + 8 (fixo).
  if (digitos.length === 11 || digitos.length === 10) {
    digitos = `55${digitos}`;
    return digitos;
  }
  // DDI de outro país (não mexemos), desde que plausível.
  if (digitos.length >= 11 && digitos.length <= 15 && !digitos.startsWith("55")) {
    return digitos;
  }
  return null;
}

/** Exibição no painel: +55 (31) 99999-8888. */
export function formatarE164(e164: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  if (!m) return `+${e164}`;
  return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
}

// ------------------------------------------------------------
// Graph API
// ------------------------------------------------------------

interface ErroDaMeta {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
  };
}

// A Meta responde em inglês; nada disso pode chegar cru no painel.
function traduzirErroMeta(payload: ErroDaMeta, httpStatus: number): string {
  const err = payload.error;
  const msg = err?.message ?? "";
  const code = err?.code;

  if (code === 190 || httpStatus === 401) {
    return "Token do WhatsApp inválido ou expirado. Reconecte o número.";
  }
  if (code === 100 && /phone_number_id|Unsupported get request/i.test(msg)) {
    return "ID do número não encontrado nessa conta. Confira o Phone Number ID.";
  }
  if (code === 200 || code === 10 || httpStatus === 403) {
    return "O token não tem permissão nessa conta do WhatsApp (falta whatsapp_business_messaging).";
  }
  if (code === 131026) {
    return "Esse número não tem WhatsApp ativo.";
  }
  if (code === 131047) {
    return "Fora da janela de 24h — só dá pra enviar template aprovado.";
  }
  if (code === 131049 || code === 131050) {
    return "A Meta bloqueou o envio pra esse cliente por limite de marketing. Tente mais tarde.";
  }
  if (code === 132000 || code === 132001) {
    return "Template não encontrado ou com número de variáveis diferente do configurado.";
  }
  if (code === 132015 || code === 132016) {
    return "Template pausado ou desabilitado pela Meta. Escolha outro.";
  }
  if (code === 130429 || code === 4 || httpStatus === 429) {
    return "Limite de envios da Meta atingido. Aguarde alguns minutos.";
  }
  if (code === 131031) {
    return "A conta do WhatsApp está bloqueada pela Meta.";
  }
  if (err?.error_user_msg) return err.error_user_msg;
  return "O WhatsApp recusou a operação. Confira a conexão do número.";
}

async function chamarGraph<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<{ data?: T; error?: string }> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    return { error: "Não foi possível falar com o WhatsApp agora. Tente de novo." };
  }

  const texto = await resposta.text();
  let corpo: unknown = {};
  try {
    corpo = texto ? JSON.parse(texto) : {};
  } catch {
    return { error: "Resposta inesperada do WhatsApp." };
  }

  if (!resposta.ok) {
    return { error: traduzirErroMeta(corpo as ErroDaMeta, resposta.status) };
  }
  return { data: corpo as T };
}

// ------------------------------------------------------------
// Operações
// ------------------------------------------------------------

/** Confere se o token abre mesmo o número — usado ao conectar no painel. */
export async function verificarNumero(
  cred: Omit<CredenciaisWhatsApp, "wabaId">,
): Promise<{ error?: string; displayPhone?: string; verifiedName?: string }> {
  const url = `${GRAPH}/${cred.apiVersion}/${cred.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`;
  const { data, error } = await chamarGraph<{
    display_phone_number?: string;
    verified_name?: string;
  }>(url, cred.accessToken);

  if (error) return { error };
  return {
    displayPhone: data?.display_phone_number,
    verifiedName: data?.verified_name,
  };
}

/**
 * Inscreve o app da plataforma na conta comercial do negócio. Sem isso a Meta
 * não manda nada pro nosso webhook — status de entrega e resposta do cliente
 * nunca chegariam.
 */
export async function assinarAppNaConta(
  cred: CredenciaisWhatsApp,
): Promise<{ error?: string }> {
  const url = `${GRAPH}/${cred.apiVersion}/${cred.wabaId}/subscribed_apps`;
  const { error } = await chamarGraph<{ success?: boolean }>(url, cred.accessToken, {
    method: "POST",
  });
  return { error };
}

/**
 * Templates da conta. Só os APPROVED servem pra campanha, mas devolvemos
 * todos: ver "PENDING" no painel explica por que o template ainda não aparece
 * pra escolher.
 */
export async function listarTemplates(
  cred: CredenciaisWhatsApp,
): Promise<{ error?: string; templates?: WhatsAppTemplate[] }> {
  const url = `${GRAPH}/${cred.apiVersion}/${cred.wabaId}/message_templates?limit=200&fields=name,language,status,category,components`;
  const { data, error } = await chamarGraph<{ data?: TemplateDaMeta[] }>(
    url,
    cred.accessToken,
  );
  if (error) return { error };

  const templates = (data?.data ?? []).map((t): WhatsAppTemplate => {
    const body = t.components?.find((c) => c.type === "BODY")?.text ?? "";
    return {
      name: t.name,
      language: t.language,
      status: t.status,
      category: (["MARKETING", "UTILITY", "AUTHENTICATION"] as string[]).includes(
        t.category,
      )
        ? (t.category as TemplateCategory)
        : "MARKETING",
      body,
      variableCount: contarVariaveis(body),
    };
  });
  return { templates };
}

/** Quantos {{n}} distintos o corpo do template usa. */
export function contarVariaveis(body: string): number {
  const encontrados = new Set<number>();
  for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) encontrados.add(Number(m[1]));
  return encontrados.size === 0 ? 0 : Math.max(...encontrados);
}

/** Substitui {{1}}, {{2}}… pelos valores — só pra pré-visualizar no painel. */
export function preencherPreview(body: string, valores: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => valores[Number(n) - 1] ?? `{{${n}}}`);
}

/**
 * Dispara um template para um número. Devolve o wamid, que é o que amarra o
 * status que chega depois pelo webhook.
 */
export async function enviarTemplate(
  cred: CredenciaisWhatsApp,
  opts: {
    to: string; // E.164 sem "+"
    template: string;
    language: string;
    variaveis: string[];
  },
): Promise<{ error?: string; messageId?: string }> {
  const url = `${GRAPH}/${cred.apiVersion}/${cred.phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: opts.to,
    type: "template",
    template: {
      name: opts.template,
      language: { code: opts.language },
      // Sem variáveis a Meta recusa um "components" vazio — omite o campo.
      ...(opts.variaveis.length > 0 && {
        components: [
          {
            type: "body",
            parameters: opts.variaveis.map((v) => ({ type: "text", text: v })),
          },
        ],
      }),
    },
  };

  const { data, error } = await chamarGraph<{
    messages?: { id?: string }[];
  }>(url, cred.accessToken, { method: "POST", body: JSON.stringify(body) });

  if (error) return { error };
  return { messageId: data?.messages?.[0]?.id };
}
