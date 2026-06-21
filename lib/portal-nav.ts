import type { IconKey } from "@/components/icons";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: IconKey;
  module?: string; // módulo que gateia o item (undefined = sempre visível)
}

// Definição canônica da navegação do portal, em ordem. Itens com `module` só
// aparecem se aquele módulo estiver ativo. Usado pelo layout real e pelo preview.
export const PORTAL_NAV: PortalNavItem[] = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/atendente", label: "Atendente IA", icon: "chat" },
  { href: "/agendamentos", label: "Agendamentos", icon: "calendar", module: "appointments" },
  { href: "/tratamentos", label: "Tratamentos", icon: "activity", module: "care_plans" },
  { href: "/documentos", label: "Documentos", icon: "document", module: "documents" },
  { href: "/parcerias", label: "Parcerias", icon: "gift", module: "partnerships" },
  { href: "/engajamento", label: "Engajamento", icon: "award" },
  { href: "/historico", label: "Histórico", icon: "clock" },
  { href: "/loja", label: "Loja de Resgate", icon: "store" },
  { href: "/planos", label: "Planos", icon: "card" },
  { href: "/perfil", label: "Perfil", icon: "user" },
];

// Itens visíveis para um conjunto de módulos ativos.
export function buildPortalNav(
  modules: Record<string, boolean> | null | undefined,
): PortalNavItem[] {
  const mod = modules ?? {};
  return PORTAL_NAV.filter((item) => !item.module || mod[item.module] === true);
}
