import type { NextConfig } from "next";

// Headers de segurança padrão (OWASP). CSP fica de fora: o SDK do Facebook
// (cadastro do WhatsApp) e o script inline de tema exigiriam nonce por request.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Imagem Docker enxuta (ver Dockerfile).
  output: "standalone",
  // pdfjs carrega o worker e o @napi-rs/canvas do node_modules em runtime:
  // empacotado pelo bundler, o upload de modelo PDF quebrava.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // O tracing do standalone não enxerga esses imports dinâmicos (worker e
  // binário nativo do canvas, da plataforma em que a imagem foi buildada).
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/.pnpm/pdfjs-dist@*/node_modules/@napi-rs/canvas",
      "./node_modules/.pnpm/pdf-parse@*/node_modules/@napi-rs/canvas",
      "./node_modules/.pnpm/@napi-rs+canvas*/node_modules/@napi-rs/**",
    ],
  },
  // Dev roda em lvh.me / <tenant>.lvh.me (README); sem isso o Next bloqueia
  // os assets de dev e a página não hidrata.
  allowedDevOrigins: ["lvh.me", "*.lvh.me"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
