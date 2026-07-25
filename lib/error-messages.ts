// Traduz mensagens técnicas (Supabase Auth, Postgres, rede) para PT-BR.
// Nenhuma mensagem em inglês deve chegar ao usuário: tudo que sai de uma
// action/route para a UI passa por `traduzirErro`.

const FALLBACK = "Não foi possível concluir a operação. Tente novamente.";

// Códigos curtos usados em `?error=` pelas actions.
const CODIGOS: Record<string, string> = {
  campos: "Preencha todos os campos obrigatórios.",
  pontos: "Você ainda não tem pontos suficientes para esse prêmio.",
  esgotado: "Esse prêmio está esgotado.",
  indisponivel: "Esse prêmio não está mais disponível.",
  sem_carteirinha: "Você ainda não tem uma carteirinha ativa.",
};

// Casadas em ordem — a primeira regex que casar vence. Grupos de captura
// podem ser usados na tradução via $1.
const TRADUCOES: Array<[RegExp, string]> = [
  // ---------- Supabase Auth ----------
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."],
  [/(user already registered|already been registered|email address is already)/i, "Este e-mail já está cadastrado."],
  [/password should be at least (\d+)/i, "A senha precisa ter pelo menos $1 caracteres."],
  [/(password is too weak|weak.?password|password is known to be weak)/i, "Senha muito fraca. Escolha uma senha mais forte."],
  [/new password should be different/i, "A nova senha precisa ser diferente da atual."],
  [/unable to validate email address/i, "E-mail inválido."],
  [/(invalid email|email address .* is invalid)/i, "E-mail inválido."],
  [/you can only request this after (\d+) seconds?/i, "Aguarde $1 segundos antes de tentar novamente."],
  [/(email rate limit exceeded|over_email_send_rate_limit)/i, "Muitos e-mails enviados. Aguarde alguns minutos e tente de novo."],
  [/(over_request_rate_limit|too many requests|rate limit)/i, "Muitas tentativas. Aguarde alguns instantes e tente de novo."],
  [/signups? not allowed/i, "Cadastro indisponível no momento."],
  [/(user not found|user with this email not found)/i, "Usuário não encontrado."],
  [/(token has expired or is invalid|otp_expired|email link is invalid or has expired)/i, "Link expirado ou inválido. Solicite um novo."],
  [/(auth session missing|invalid refresh token|refresh token not found|jwt expired|session_not_found)/i, "Sua sessão expirou. Entre novamente."],
  [/captcha/i, "Falha na verificação de segurança. Recarregue a página e tente de novo."],
  [/database error (saving|granting|finding|querying)/i, "Erro ao processar sua conta. Tente novamente em instantes."],
  [/(email_address_not_authorized|not authorized to send)/i, "Não foi possível enviar o e-mail para este endereço."],
  [/(provider is not enabled|oauth)/i, "Este método de login não está habilitado."],
  [/user is banned/i, "Esta conta está bloqueada. Fale com o suporte."],
  [/(anonymous sign-ins|signup is disabled)/i, "Cadastro indisponível no momento."],

  // ---------- Postgres / PostgREST ----------
  [/duplicate key value violates unique constraint/i, "Já existe um registro com esses dados."],
  [/violates foreign key constraint/i, "Este registro está vinculado a outros dados e não pode ser alterado."],
  [/violates not-null constraint/i, "Preencha todos os campos obrigatórios."],
  [/violates check constraint/i, "Algum valor informado é inválido."],
  [/violates row-level security policy/i, "Você não tem permissão para esta ação."],
  [/permission denied/i, "Você não tem permissão para esta ação."],
  [/value too long for type/i, "Um dos textos informados é longo demais."],
  [/invalid input syntax/i, "Algum valor informado está em formato inválido."],
  [/(could not find|does not exist).*(column|relation|table|function)/i, "Erro interno ao acessar os dados. Tente novamente."],
  [/(no rows|multiple \(or no\) rows returned|results contain 0 rows)/i, "Registro não encontrado."],
  [/(statement timeout|canceling statement due to)/i, "A operação demorou demais. Tente novamente."],
  [/(payload too large|exceeded the maximum allowed size|file size)/i, "Arquivo muito grande."],
  [/(mime type|invalid file type)/i, "Formato de arquivo não suportado."],
  [/(bucket not found|object not found)/i, "Arquivo não encontrado."],

  // ---------- Rede / genéricos ----------
  [/(fetch failed|failed to fetch|network(error)?|econnrefused|etimedout|socket hang up)/i, "Falha de conexão. Verifique sua internet e tente novamente."],
  [/(internal server error|unexpected|something went wrong)/i, FALLBACK],
  [/(not found|404)/i, "Registro não encontrado."],
  [/(unauthorized|401|403|forbidden)/i, "Você não tem permissão para esta ação."],
];

// Marcadores de português — mensagens já escritas pela aplicação passam
// direto, sem cair no fallback genérico.
const PT_ACENTO = /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/;
const PT_PALAVRAS =
  /\b(nao|erro|senha|conta|cadastro|campos?|preencha|informe|selecione|slug|plano|cliente|pontos|premio|carteirinha|assinatura|negocio|arquivo|tente|dados|em uso|invalido|indisponivel|esgotado|obrigatorio)\b/i;

function pareceportugues(msg: string) {
  return PT_ACENTO.test(msg) || PT_PALAVRAS.test(msg);
}

/**
 * Converte a mensagem crua de um erro em texto PT-BR exibível.
 * Mensagens já em português são devolvidas como estão; inglês desconhecido
 * cai no fallback genérico (nunca vaza para a tela).
 */
export function traduzirErro(raw?: string | null, fallback = FALLBACK): string {
  const msg = raw?.trim();
  if (!msg) return fallback;

  const codigo = CODIGOS[msg];
  if (codigo) return codigo;

  for (const [re, pt] of TRADUCOES) {
    const m = msg.match(re);
    // Só os grupos capturados entram na tradução ($1, $2…) — o resto da
    // mensagem original é descartado.
    if (m) return pt.replace(/\$(\d)/g, (_, i: string) => m[Number(i)] ?? "");
  }

  if (pareceportugues(msg)) return msg;

  console.error("[erro nao traduzido]", msg);
  return fallback;
}

/** Igual a `traduzirErro`, aceitando um erro desconhecido (catch). */
export function traduzirErroDesconhecido(err: unknown, fallback = FALLBACK): string {
  if (err instanceof Error) return traduzirErro(err.message, fallback);
  if (typeof err === "string") return traduzirErro(err, fallback);
  return fallback;
}
