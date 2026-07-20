import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppToaster } from "@/components/app-toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fidelidade — programa de fidelidade para o seu negócio",
    // Cada portal de cliente sobrescreve o título com o nome do próprio
    // negócio (ver app/(portal)/layout.tsx).
    template: "%s | Fidelidade",
  },
  description:
    "Plataforma de fidelidade white-label: carteirinha digital, missões, recompensas, agendamentos e assistente de IA com a marca do seu negócio.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Fidelidade",
    title: "Fidelidade — programa de fidelidade para o seu negócio",
    description:
      "Carteirinha digital, missões, recompensas e assistente de IA com a marca do seu negócio.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Set data-theme before paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("theme")||"light";document.documentElement.setAttribute("data-theme",t)})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
