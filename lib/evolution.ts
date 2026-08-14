import "server-only";

// Cliente do Evolution API — o caminho de conexão por QR code, alternativa ao
// Cloud API da Meta (lib/whatsapp.ts). Só fala HTTP; quem decide qual provedor
// usar é lib/tenant-whatsapp.ts.
//
// Diferenças que mudam o desenho de tudo que chama daqui:
//  • não existe template: mensagem é texto livre, sem aprovação prévia;
//  • não existe janela de 24h nem cobrança por mensagem;
//  • a sessão é do WhatsApp Web, então cai sozinha (celular sem bateria,
//    logout no aparelho) e precisa de novo QR code.
//
// O servidor é único da plataforma e a apikey é global: cada negócio vira uma
// "instância" nomeada com o tenant_id. Quem tem a apikey controla todas as
// instâncias — ela nunca pode chegar ao browser.

export interface Instancia {
  /** Nome da instância no servidor Evolution — é o tenant_id. */
  nome: string;
}

/** Estado da sessão do WhatsApp Web daquela instância. */
export type EstadoConexao = "open" | "connecting" | "close";

export interface ServidorEvolution {
  baseUrl: string;
  apiKey: string;
}

/** Config do servidor, ou null quando a instalação não tem Evolution. */
export function servidorEvolution(): ServidorEvolution | null {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

// ------------------------------------------------------------
// HTTP
// ------------------------------------------------------------

interface ErroEvolution {
  message?: string | string[];
  error?: string;
  response?: { message?: string | string[] };
}

// O Evolution responde em inglês e às vezes com array de mensagens; nada disso
// pode chegar cru no painel.
function traduzirErro(payload: ErroEvolution, httpStatus: number): string {
  const bruto = payload.response?.message ?? payload.message ?? payload.error ?? "";
  const msg = Array.isArray(bruto) ? bruto.join(" ") : String(bruto);

  if (httpStatus === 401 || httpStatus === 403) {
    return "O servidor de WhatsApp recusou a credencial da plataforma.";
  }
  if (/already in use|already exists/i.test(msg)) {
    return "Já existe uma conexão para este negócio. Desconecte antes de conectar de novo.";
  }
  if (/not found|does not exist/i.test(msg)) {
    return "Conexão não encontrada no servidor. Reconecte pelo QR code.";
  }
  if (/not connected|close|Connection Closed/i.test(msg)) {
    return "O WhatsApp está desconectado. Leia o QR code de novo.";
  }
  if (/exists.*not.*whatsapp|number.*not.*exist/i.test(msg)) {
    return "Esse número não tem WhatsApp.";
  }
  if (httpStatus === 429) {
    return "Muitos envios seguidos. Aguarde alguns minutos.";
  }
  return "O servidor de WhatsApp recusou a operação. Tente de novo.";
}

async function chamar<T>(
  servidor: ServidorEvolution,
  caminho: string,
  init?: RequestInit,
): Promise<{ data?: T; error?: string }> {
  let resposta: Response;
  try {
    resposta = await fetch(`${servidor.baseUrl}${caminho}`, {
      ...init,
      headers: {
        apikey: servidor.apiKey,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    return { error: "Não foi possível falar com o servidor de WhatsApp agora." };
  }

  const texto = await resposta.text();
  let corpo: unknown = {};
  try {
    corpo = texto ? JSON.parse(texto) : {};
  } catch {
    return { error: "Resposta inesperada do servidor de WhatsApp." };
  }

  if (!resposta.ok) {
    return { error: traduzirErro(corpo as ErroEvolution, resposta.status) };
  }
  return { data: corpo as T };
}

// ------------------------------------------------------------
// Telefone
// ------------------------------------------------------------

/**
 * O WhatsApp identifica contato por JID ("5531999998888@s.whatsapp.net"). O
 * resto do sistema trabalha com E.164 sem "+", então a conversão fica aqui.
 */
export function jidParaE164(jid: string): string {
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "");
}

// ------------------------------------------------------------
// Instância
// ------------------------------------------------------------

interface RespostaCriar {
  instance?: { instanceName?: string; status?: string };
  qrcode?: { base64?: string; code?: string };
}

/**
 * Cria a instância do negócio. Idempotente do ponto de vista de quem chama:
 * instância que já existe não é erro, porque reconectar depois de uma queda
 * cai exatamente nesse caso.
 */
export async function criarInstancia(
  servidor: ServidorEvolution,
  nome: string,
): Promise<{ error?: string; jaExistia?: boolean }> {
  const { error } = await chamar<RespostaCriar>(servidor, "/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: nome,
      integration: "WHATSAPP-BAILEYS",
      qrcode: false,
    }),
  });

  if (!error) return {};
  if (/Já existe uma conexão/.test(error)) return { jaExistia: true };
  return { error };
}

/**
 * Aponta o webhook da instância pro nosso endpoint. Sem isso o disparo funciona
 * mas fica cego: status de entrega e resposta do cliente nunca chegam.
 *
 * MESSAGES_UPSERT traz mensagem recebida (é o que abre a janela e o que carrega
 * o "SAIR"); MESSAGES_UPDATE traz a confirmação de entrega e leitura;
 * CONNECTION_UPDATE avisa quando a sessão cai.
 */
export async function configurarWebhook(
  servidor: ServidorEvolution,
  nome: string,
  url: string,
): Promise<{ error?: string }> {
  const { error } = await chamar(servidor, `/webhook/set/${encodeURIComponent(nome)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
      },
    }),
  });
  return { error };
}

interface RespostaConectar {
  base64?: string;
  code?: string;
  pairingCode?: string | null;
  count?: number;
  instance?: { state?: string };
}

/**
 * Pede o QR code da instância. Devolve null em `qrCode` quando a sessão já
 * está aberta — o Evolution responde com o estado em vez do código.
 *
 * O QR expira em segundos e o Evolution gera um novo a cada chamada; o painel
 * repete essa chamada enquanto o dono não lê.
 */
export async function obterQrCode(
  servidor: ServidorEvolution,
  nome: string,
): Promise<{ error?: string; qrCode?: string | null; jaConectado?: boolean }> {
  const { data, error } = await chamar<RespostaConectar>(
    servidor,
    `/instance/connect/${encodeURIComponent(nome)}`,
  );
  if (error) return { error };

  if (data?.instance?.state === "open") return { jaConectado: true, qrCode: null };
  // `base64` já vem como data URI pronta pra <img src>.
  return { qrCode: data?.base64 ?? null };
}

interface RespostaEstado {
  instance?: { instanceName?: string; state?: EstadoConexao };
}

export async function estadoDaConexao(
  servidor: ServidorEvolution,
  nome: string,
): Promise<{ error?: string; estado?: EstadoConexao }> {
  const { data, error } = await chamar<RespostaEstado>(
    servidor,
    `/instance/connectionState/${encodeURIComponent(nome)}`,
  );
  if (error) return { error };
  return { estado: data?.instance?.state ?? "close" };
}

interface LinhaInstancia {
  name?: string;
  instanceName?: string;
  ownerJid?: string;
  owner?: string;
  profileName?: string;
  connectionStatus?: string;
}

/**
 * Qual número foi conectado e com que nome de perfil — o painel mostra isso
 * como "Conectado — +55 31 …", igual ao caminho da Meta.
 */
export async function dadosDaInstancia(
  servidor: ServidorEvolution,
  nome: string,
): Promise<{ error?: string; telefone?: string | null; perfil?: string | null }> {
  const { data, error } = await chamar<LinhaInstancia[] | LinhaInstancia>(
    servidor,
    `/instance/fetchInstances?instanceName=${encodeURIComponent(nome)}`,
  );
  if (error) return { error };

  // A resposta já veio como objeto único em algumas versões e como lista em
  // outras — normaliza aqui pra não espalhar o `if` pelo resto do código.
  const lista = Array.isArray(data) ? data : data ? [data] : [];
  const linha = lista.find((i) => (i.name ?? i.instanceName) === nome) ?? lista[0];
  if (!linha) return { telefone: null, perfil: null };

  const jid = linha.ownerJid ?? linha.owner ?? "";
  return {
    telefone: jid ? jidParaE164(jid) : null,
    perfil: linha.profileName ?? null,
  };
}

/** Encerra a sessão mas mantém a instância — o dono pode reler o QR depois. */
export async function desconectarInstancia(
  servidor: ServidorEvolution,
  nome: string,
): Promise<{ error?: string }> {
  const { error } = await chamar(servidor, `/instance/logout/${encodeURIComponent(nome)}`, {
    method: "DELETE",
  });
  return { error };
}

/** Apaga a instância e a sessão salva no servidor. */
export async function apagarInstancia(
  servidor: ServidorEvolution,
  nome: string,
): Promise<{ error?: string }> {
  const { error } = await chamar(servidor, `/instance/delete/${encodeURIComponent(nome)}`, {
    method: "DELETE",
  });
  return { error };
}

// ------------------------------------------------------------
// Envio
// ------------------------------------------------------------

interface RespostaEnvio {
  key?: { id?: string; remoteJid?: string };
  status?: string;
}

/**
 * Manda texto livre. Devolve o id da mensagem, que é o que amarra o status que
 * chega depois pelo webhook — mesmo papel do wamid no caminho da Meta.
 *
 * `delay` é honrado pelo próprio servidor entre o "digitando…" e o envio.
 * Vale usar em campanha: rajada instantânea é o padrão que mais provoca
 * banimento do número.
 */
export async function enviarTexto(
  servidor: ServidorEvolution,
  nome: string,
  opts: { to: string; texto: string; delayMs?: number },
): Promise<{ error?: string; messageId?: string }> {
  const { data, error } = await chamar<RespostaEnvio>(
    servidor,
    `/message/sendText/${encodeURIComponent(nome)}`,
    {
      method: "POST",
      body: JSON.stringify({
        number: opts.to,
        text: opts.texto,
        ...(opts.delayMs ? { delay: opts.delayMs } : {}),
      }),
    },
  );

  if (error) return { error };
  return { messageId: data?.key?.id };
}
