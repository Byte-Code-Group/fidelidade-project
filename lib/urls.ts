// Endereço público do portal de um negócio.
//
// O esquema não pode ser fixo em "http://": em produção o portal só responde
// em https, e um link http vai parar em e-mail de recuperação de senha, QR de
// check-in e e-mail de boas-vindas. Em dev (lvh.me) continua http.

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000";

function scheme(host: string): string {
  const semPorta = host.split(":")[0].toLowerCase();
  const local =
    semPorta === "localhost" ||
    semPorta === "127.0.0.1" ||
    semPorta.endsWith(".localhost") ||
    semPorta.endsWith("lvh.me");
  return local ? "http://" : "https://";
}

/** Ex.: https://oraldents.fideliza.com.br (http://oraldents.lvh.me:3000 em dev). */
export function portalUrl(slug: string, path = ""): string {
  const host = `${slug}.${ROOT_DOMAIN}`;
  return `${scheme(host)}${host}${path}`;
}

/** Endereço da própria plataforma (área do dono, superadmin). */
export function siteUrl(path = ""): string {
  const configurado = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurado) return `${configurado.replace(/\/$/, "")}${path}`;
  return `${scheme(ROOT_DOMAIN)}${ROOT_DOMAIN}${path}`;
}
