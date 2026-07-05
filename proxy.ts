import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { TENANT_SLUG_HEADER } from "@/lib/tenant";

// Domínio base (ex.: "lvh.me:3000" em dev, "meuplataforma.com.br" em prod).
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000")
  .split(":")[0]
  .toLowerCase();

// Extrai o slug do tenant a partir do subdomínio do header Host.
//   oraldents.lvh.me        -> "oraldents"
//   lvh.me / www.lvh.me     -> null (apex)
//   qualquer outro host     -> null (não é subdomínio do ROOT_DOMAIN)
function resolveSubdomainSlug(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  if (!hostname.endsWith(ROOT_DOMAIN)) return null;

  const sub = hostname.slice(0, -ROOT_DOMAIN.length).replace(/\.$/, "");
  if (!sub || sub === "www") return null; // apex
  // pega o primeiro label (ignora subdomínios aninhados)
  return sub.split(".")[0];
}

// Host que não é subdomínio do ROOT_DOMAIN nem localhost: candidato a
// domínio customizado (white-label), resolvido por custom_domain no DB.
function isCustomDomainCandidate(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0].toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  return !hostname.endsWith(ROOT_DOMAIN);
}

const TENANT_COOKIE = "x-tenant-slug";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const parts = pathname.split("/");

  // Path-based portal: /p/[slug]/... → rewrite to /... + grava cookie
  if (parts[1] === "p" && parts[2]) {
    const slug = parts[2];
    const rest = "/" + parts.slice(3).join("/");

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = rest || "/";

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(TENANT_SLUG_HEADER, slug);

    const response = NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    });
    // Cookie persiste o slug para navegações internas sem o prefix /p/[slug]
    response.cookies.set(TENANT_COOKIE, slug, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    return updateSession(request, response);
  }

  const host = request.headers.get("host");
  let slug = resolveSubdomainSlug(host);

  if (!slug) {
    const cookieSlug = request.cookies.get(TENANT_COOKIE)?.value ?? null;

    if (
      cookieSlug &&
      !pathname.startsWith("/superadmin") &&
      !pathname.startsWith("/conta") &&
      !pathname.startsWith("/painel") &&
      !pathname.startsWith("/api/")
    ) {
      // Redireciona para URL canônica /p/[slug]/... para manter slug visível
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/p/${cookieSlug}${pathname === "/" ? "" : pathname}`;
      return NextResponse.redirect(redirectUrl);
    }

    // Sem cookie: se o host não bate com o ROOT_DOMAIN, pode ser domínio
    // customizado (white-label) — sinaliza p/ lookup por custom_domain.
    if (isCustomDomainCandidate(host)) {
      slug = `@${host!.split(":")[0].toLowerCase()}`;
    }
  }

  const requestHeaders = new Headers(request.headers);
  if (slug) {
    requestHeaders.set(TENANT_SLUG_HEADER, slug);
  } else {
    requestHeaders.delete(TENANT_SLUG_HEADER);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return updateSession(request, response);
}

export const config = {
  matcher: [
    // tudo, exceto assets estáticos e otimização de imagem
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
