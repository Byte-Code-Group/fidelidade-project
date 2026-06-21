import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { TENANT_SLUG_HEADER } from "@/lib/tenant";

// Domínio base (ex.: "lvh.me:3000" em dev, "meuplataforma.com.br" em prod).
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000")
  .split(":")[0]
  .toLowerCase();

// Extrai o slug do tenant a partir do header Host.
//   oraldents.lvh.me        -> "oraldents"
//   lvh.me / www.lvh.me     -> null (apex)
//   clinica.com.br (custom) -> "@clinica.com.br" (resolvido por custom_domain)
function resolveTenantSlug(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();

  if (hostname.endsWith(ROOT_DOMAIN)) {
    const sub = hostname.slice(0, -ROOT_DOMAIN.length).replace(/\.$/, "");
    if (!sub || sub === "www") return null; // apex
    // pega o primeiro label (ignora subdomínios aninhados)
    return sub.split(".")[0];
  }

  // Domínio próprio (white-label total): sinaliza p/ lookup por custom_domain.
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  return `@${hostname}`;
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

  // Subdomínio (produção com domínio customizado) tem prioridade sobre cookie
  let slug = resolveTenantSlug(request.headers.get("host"));

  // Fallback: cookie gravado na entrada via /p/[slug] (sem domínio customizado)
  if (!slug && !pathname.startsWith("/superadmin") && !pathname.startsWith("/api/webhooks")) {
    slug = request.cookies.get(TENANT_COOKIE)?.value ?? null;
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
