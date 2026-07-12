// Metadados de exibição dos planos SaaS — usado na tela de planos do
// cadastro e na tela de assinatura do painel. Preço vem de PLAN_PRICES
// (lib/asaas.ts) e limite de negócios de TENANT_LIMITS (lib/tenant-limits.ts)
// pra não duplicar a fonte de verdade em mais de um lugar.
export interface PlanMeta {
  key: string;
  name: string;
  features: string[];
  highlight?: boolean;
}

export const PLAN_CATALOG: PlanMeta[] = [
  {
    key: "starter",
    name: "Starter",
    features: [
      "1 negócio",
      "Até 200 clientes",
      "IA com 50k tokens/mês",
      "Módulos básicos",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    features: [
      "Até 3 negócios",
      "Até 1.000 clientes",
      "IA com 500k tokens/mês",
      "Todos os módulos",
    ],
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    features: [
      "Negócios ilimitados",
      "Clientes ilimitados",
      "IA ilimitada",
      "Todos os módulos + suporte prioritário",
    ],
  },
];
