import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ABSOLUTE_TIMEOUT_MS,
  decidirExpiracao,
  LAST_ACTIVITY_COOKIE,
  SESSION_EXPIRY_MESSAGES,
  SESSION_START_COOKIE,
  SESSION_START_PUBLIC_COOKIE,
  type SessionExpiryReason,
} from "@/lib/session-limits";

const PROD = process.env.NODE_ENV === "production";

function cookieOptions(maxAgeMs: number, httpOnly = true) {
  return {
    path: "/",
    httpOnly,
    sameSite: "lax" as const,
    secure: PROD,
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

// Requests de fundo (polling automático) não contam como atividade do
// usuário — senão uma aba esquecida aberta mantém a sessão viva pra sempre.
const CAMINHOS_DE_POLLING = ["/api/conta/status"];

const RASTREIO_COOKIES = [
  SESSION_START_COOKIE,
  LAST_ACTIVITY_COOKIE,
  SESSION_START_PUBLIC_COOKIE,
];

function limparCookiesDeSessao(response: NextResponse) {
  for (const name of RASTREIO_COOKIES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

function lerNumero(request: NextRequest, name: string): number | null {
  const raw = request.cookies.get(name)?.value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// O cookie de início guarda `${session_id}.${ms}`: se o session_id mudou
// (novo login), o contador das 10h recomeça do zero.
function lerInicioDaSessao(request: NextRequest, sessionId: string): number | null {
  const raw = request.cookies.get(SESSION_START_COOKIE)?.value;
  if (!raw) return null;
  const sep = raw.lastIndexOf(".");
  if (sep < 0) return null;
  if (raw.slice(0, sep) !== sessionId) return null;
  const n = Number(raw.slice(sep + 1));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Sessão estourada: apaga os cookies de auth e manda pro login (ou 401 nas
// rotas de API, que não podem redirecionar).
function respostaDeExpiracao(
  request: NextRequest,
  base: NextResponse,
  loginPath: string,
  reason: SessionExpiryReason,
): NextResponse {
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  let out: NextResponse;
  if (isApi) {
    out = NextResponse.json(
      { error: SESSION_EXPIRY_MESSAGES[reason] },
      { status: 401 },
    );
  } else {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.search = `expirado=${reason}`;
    out = NextResponse.redirect(url);
  }

  // Preserva o que o middleware já escreveu (cookie de tenant, refresh de
  // sessão) e só depois derruba os cookies de auth.
  for (const cookie of base.cookies.getAll()) out.cookies.set(cookie);
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      out.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
  limparCookiesDeSessao(out);
  return out;
}

// Refresh de sessão Supabase no edge + repasse de cookies + limites de
// inatividade (3h) e de duração total da sessão (10h).
// Recebe o response base (já com o header de tenant) p/ preservar headers.
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
  loginPath = "/login",
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: não rodar lógica entre createServerClient e getClaims.
  const { data } = await supabase.auth.getClaims();

  const claims = data?.claims;
  if (!claims) {
    // Sem sessão: não deixa cookie de rastreio pendurado.
    if (request.cookies.get(SESSION_START_COOKIE)) limparCookiesDeSessao(response);
    return response;
  }

  const sessionId =
    typeof claims.session_id === "string" ? claims.session_id : String(claims.sub);
  const now = Date.now();
  const start = lerInicioDaSessao(request, sessionId) ?? now;
  const lastActivity = lerNumero(request, LAST_ACTIVITY_COOKIE);

  const reason = decidirExpiracao({
    now,
    start,
    lastActivity,
    rastreioEmCurso: Boolean(request.cookies.get(SESSION_START_COOKIE)),
  });

  if (reason) {
    // scope local: encerra só esta sessão (outros dispositivos seguem logados).
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    return respostaDeExpiracao(request, response, loginPath, reason);
  }

  // O maxAge das 10h garante que o cookie de início nunca sobreviva ao limite.
  response.cookies.set(
    SESSION_START_COOKIE,
    `${sessionId}.${start}`,
    cookieOptions(ABSOLUTE_TIMEOUT_MS),
  );
  // Versão legível no browser — o watcher precisa saber quando a sessão começou.
  response.cookies.set(
    SESSION_START_PUBLIC_COOKIE,
    String(start),
    cookieOptions(ABSOLUTE_TIMEOUT_MS, false),
  );
  // maxAge das 10h (não das 3h): a comparação de timestamp é que decide a
  // inatividade — o cookie não pode sumir antes disso.
  const ehPolling = CAMINHOS_DE_POLLING.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );
  if (!ehPolling) {
    response.cookies.set(
      LAST_ACTIVITY_COOKIE,
      String(now),
      cookieOptions(ABSOLUTE_TIMEOUT_MS),
    );
  }

  return response;
}
