// Status da carteirinha como o dono lê: rótulo em português + tom do Badge.
export const MEMBERSHIP_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Ativa", tone: "success" },
  expired: { label: "Vencida", tone: "warning" },
  suspended: { label: "Suspensa", tone: "danger" },
  inactive: { label: "Inativa", tone: "neutral" },
};

export function membershipStatus(status: string) {
  return MEMBERSHIP_STATUS[status] ?? { label: status || "Sem carteirinha", tone: "neutral" as const };
}
