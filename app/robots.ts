import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Só a landing de marketing é indexável. Painel do dono, superadmin, portais
// de cliente e APIs ficam fora dos buscadores.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/painel",
          "/superadmin",
          "/conta",
          "/api",
          "/p/",
          "/perfil",
          "/historico",
          "/checkin",
          "/documentos",
          "/agendamentos",
          "/atendente",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
