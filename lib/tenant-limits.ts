import "server-only";

// Quantos negócios um owner pode ter, de acordo com o melhor plano entre os
// que ele já possui. -1 = sem limite.
export const TENANT_LIMITS: Record<string, number> = {
  starter: 1,
  pro: 3,
  premium: -1,
};

const PLAN_RANK: Record<string, number> = { starter: 0, pro: 1, premium: 2 };

function bestPlan(plans: string[]): string {
  return plans.reduce(
    (best, p) => ((PLAN_RANK[p] ?? 0) > (PLAN_RANK[best] ?? 0) ? p : best),
    "starter",
  );
}

export function canCreateAnotherTenant(ownedPlans: string[]): {
  allowed: boolean;
  limit: number;
} {
  const limit = TENANT_LIMITS[bestPlan(ownedPlans)] ?? TENANT_LIMITS.starter;
  return { allowed: limit === -1 || ownedPlans.length < limit, limit };
}
