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

export async function proxy(request: NextRequest) {
  const slug = resolveTenantSlug(request.headers.get("host"));

  const requestHeaders = new Headers(request.headers);
  if (slug) {
    requestHeaders.set(TENANT_SLUG_HEADER, slug);
  } else {
    requestHeaders.delete(TENANT_SLUG_HEADER);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Refresh de sessão Supabase (preserva o header de tenant no response).
  return updateSession(request, response);
}

export const config = {
  matcher: [
    // tudo, exceto assets estáticos e otimização de imagem
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
