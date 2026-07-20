import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Apenas as páginas públicas de marketing do apex. Portais de tenant são
// privados (noindex em app/(portal)/layout.tsx) e não entram aqui.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/conta/cadastro`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/conta/planos`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
