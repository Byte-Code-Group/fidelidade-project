// Receitas prontas pro campo "Comportamento" do assistente (aba Assistente IA
// da customização). O campo continua 100% livre — isto é só um atalho: o dono
// clica, o texto entra no campo e ele ajusta o que estiver entre [COLCHETES].
//
// Cada snippet vira instrução no system prompt (ver app/api/chat/route.ts), que
// entra DEPOIS das regras fixas — então nada aqui pode tentar liberar preço,
// diagnóstico ou qualquer coisa que os GUARDRAILS proíbem.
//
// `requiresModule` esconde o preset quando o módulo está desligado no tenant
// (não faz sentido sugerir regra de documento sem a página de Documentos).

import type { ModuleKey } from "@/lib/segment-templates";

export interface BehaviorPreset {
  key: string;
  label: string;
  /** Uma linha no card do botão — o que o preset faz. */
  desc: string;
  requiresModule?: ModuleKey;
  snippet: string;
}

/**
 * Teto do campo Comportamento. O texto inteiro vai no system prompt de cada
 * mensagem (ver app/api/chat/route.ts), então tem limite no textarea e corte
 * no servidor (ver lib/tenant-settings.ts).
 */
export const AI_BEHAVIOR_MAX_LENGTH = 6000;

// Placeholders seguem este formato pra UI conseguir listar o que falta ajustar.
export const PLACEHOLDER_REGEX = /\[[A-ZÀ-Ú0-9][^[\]]*\]/g;

export const BEHAVIOR_PRESETS: BehaviorPreset[] = [
  {
    key: "atendimento_inicial",
    label: "Atendimento inicial",
    desc: "Como abrir a conversa, o que perguntar antes de seguir.",
    snippet: `Atendimento inicial:
- Antes de detalhar qualquer serviço, pergunte se a pessoa já é cliente daqui.
- Se for primeira vez, explique em 2 linhas como funciona: [COMO FUNCIONA O PRIMEIRO ATENDIMENTO, EX: AVALIAÇÃO DE 30 MIN SEM COMPROMISSO].
- Nossos principais serviços são: [LISTE 3 A 5 SERVIÇOS].
- Não atendemos: [O QUE NÃO É FEITO AQUI] — nesse caso, oriente a procurar um especialista.
- Encerre toda conversa com um próximo passo claro (marcar, retornar ou falar com a equipe).`,
  },
  {
    key: "agendamentos",
    label: "Agendamentos",
    desc: "Regras de horário, antecedência, remarcação e falta.",
    requiresModule: "appointments",
    snippet: `Agendamentos:
- Funcionamos [DIAS E HORÁRIOS, EX: SEG A SEX, 9H ÀS 18H; SÁB 9H ÀS 13H]. Nunca ofereça horário fora disso.
- Peça antecedência mínima de [EX: 24 HORAS] e confirme sempre motivo + data/hora antes de registrar.
- Remarcação e cancelamento: até [EX: 12 HORAS] antes. Depois disso, oriente a falar com a equipe.
- Primeira consulta é [EX: AVALIAÇÃO, DURA 40 MIN]. Peça pra chegar [EX: 10 MIN] antes.
- Se o horário pedido não existir, ofereça as duas alternativas mais próximas em vez de só negar.`,
  },
  {
    key: "documentos",
    label: "Geração de documentos",
    desc: "O que pode ser gerado pela IA e o que precisa de assinatura.",
    requiresModule: "documents",
    snippet: `Documentos:
- Pode gerar direto: [EX: DECLARAÇÃO DE COMPARECIMENTO, RECIBO, TERMO DE CONSENTIMENTO].
- Nunca gere sozinha: [EX: RECEITA, LAUDO, ATESTADO MÉDICO] — explique que precisa de [PROFISSIONAL RESPONSÁVEL, EX: A DRA. FULANA] e ofereça avisar a equipe.
- Todo documento gerado sai como rascunho: avise que passa por conferência da equipe antes de valer.
- Dado que faltar, deixe como [A PREENCHER] em vez de travar ou inventar.
- Assine sempre como [NOME QUE APARECE NO DOCUMENTO, EX: CLÍNICA X — CNPJ 00.000.000/0000-00].`,
  },
  {
    key: "precos",
    label: "Preços e orçamento",
    desc: "Resposta padrão pra valores sem quebrar as regras fixas.",
    snippet: `Preços:
- Não passe valores. Diga que depende de [O QUE DEFINE O PREÇO, EX: AVALIAÇÃO PRESENCIAL E NÚMERO DE SESSÕES] e ofereça marcar a avaliação.
- Formas de pagamento aceitas: [EX: PIX, CARTÃO EM ATÉ 6X, DINHEIRO] — isso pode ser informado.
- Convênio/plano: [DIGA SE ACEITA E QUAIS, OU "NÃO ATENDEMOS CONVÊNIO"].
- Se insistirem no valor, encaminhe pro contato da equipe em vez de repetir a mesma negativa.`,
  },
  {
    key: "fidelidade",
    label: "Fidelidade e pontos",
    desc: "Como explicar pontos, recompensas e resgates.",
    snippet: `Programa de fidelidade:
- Explique em uma frase: [COMO GANHA PONTO, EX: 1 PONTO POR ATENDIMENTO REALIZADO].
- Resgate acontece [ONDE/COMO, EX: NA RECEPÇÃO, APRESENTANDO O CÓDIGO DA CARTEIRINHA].
- Pontos [EXPIRAM EM X MESES / NÃO EXPIRAM].
- Quando o cliente estiver perto de uma recompensa, avise e diga quanto falta.
- Não crie recompensa nem prazo que não esteja cadastrado no portal.`,
  },
  {
    key: "urgencia",
    label: "Sintoma e urgência",
    desc: "Triagem sem opinar sobre saúde, com encaminhamento certo.",
    snippet: `Sintomas e urgência:
- Nunca avalie causa nem gravidade. Acolha em uma frase e vá pro próximo passo.
- Se citar [SINAIS DE URGÊNCIA, EX: DOR FORTE, SANGRAMENTO, FEBRE, INCHAÇO], oriente a procurar [ONDE, EX: PRONTO-ATENDIMENTO / NOSSO WHATSAPP AGORA] e não trate como agendamento de rotina.
- Fora de urgência, ofereça a primeira agenda disponível pra avaliação.
- Dúvida de pós-atendimento: encaminhe pra [CANAL, EX: WHATSAPP DA EQUIPE] em vez de orientar por conta.`,
  },
  {
    key: "acompanhamento",
    label: "Acompanhamento / retorno",
    desc: "Conduta em planos em andamento e retornos.",
    requiresModule: "care_plans",
    snippet: `Acompanhamento:
- Consulte o plano do cliente antes de responder sobre etapas e retornos.
- Retorno padrão é a cada [EX: 30 DIAS]. Se estiver atrasado, ofereça marcar.
- Não altere, adiante nem antecipe etapa de plano — quem decide é [QUEM, EX: O PROFISSIONAL RESPONSÁVEL].
- Cuidado entre sessões: repasse só o que já está escrito no plano; o resto, encaminhe pra equipe.`,
  },
  {
    key: "parcerias",
    label: "Parcerias e convênios",
    desc: "Como falar dos benefícios de parceiros.",
    requiresModule: "partnerships",
    snippet: `Parcerias:
- Cite só parceiros que estão na página de Parcerias do portal.
- Explique como usar o benefício: [COMO, EX: APRESENTAR A CARTEIRINHA DIGITAL NO PARCEIRO].
- Regras e validade são do parceiro — não prometa desconto nem prazo; oriente a confirmar com ele.
- Se perguntarem de parceiro que não temos, diga que não faz parte do programa hoje.`,
  },
  {
    key: "escalada",
    label: "Escalar pra equipe",
    desc: "Quando parar de responder e passar pra um humano.",
    snippet: `Escalada pra equipe humana:
- Passe pra equipe na hora em caso de: reclamação, pedido de reembolso, cobrança, exceção de regra ou insistência num assunto que você não pode resolver.
- Canal oficial: [CANAL E HORÁRIO, EX: WHATSAPP (11) 90000-0000, SEG A SEX 9H ÀS 18H].
- Ao encaminhar, resuma em uma linha o que o cliente já contou, pra ele não repetir tudo.
- Nunca prometa prazo de resposta que não seja [PRAZO REAL, EX: ATÉ 1 DIA ÚTIL].`,
  },
  {
    key: "tom",
    label: "Estilo de resposta",
    desc: "Tamanho, tratamento e vocabulário a usar/evitar.",
    snippet: `Estilo:
- Respostas curtas: até [EX: 3] frases, salvo quando o cliente pedir detalhe.
- Trate por [EX: VOCÊ / SENHOR(A)] e chame o cliente pelo primeiro nome.
- Nosso público é [PERFIL, EX: MULHERES DE 30 A 60 ANOS] — evite gíria e termo técnico.
- Nunca use: [PALAVRAS/PROMESSAS A EVITAR, EX: "GARANTIDO", "CURA", "SEM RISCO"].
- Pode usar emoji [SIM, COM MODERAÇÃO / NÃO].`,
  },
];

/** Presets válidos pro tenant, na ordem de exibição. */
export function presetsForModules(
  modules: Record<string, boolean>,
): BehaviorPreset[] {
  return BEHAVIOR_PRESETS.filter(
    (p) => !p.requiresModule || modules[p.requiresModule] === true,
  );
}

// [A PREENCHER] é instrução PRA IA (deixar o campo em branco no documento),
// não algo que o dono deva trocar aqui — fica fora da lista de pendências.
const PLACEHOLDERS_INTENCIONAIS = new Set(["[A PREENCHER]"]);

/** Placeholders ainda no texto — o que o dono precisa trocar. */
export function pendingPlaceholders(value: string): string[] {
  const encontrados = value.match(PLACEHOLDER_REGEX) ?? [];
  return [...new Set(encontrados)].filter(
    (p) => !PLACEHOLDERS_INTENCIONAIS.has(p),
  );
}
