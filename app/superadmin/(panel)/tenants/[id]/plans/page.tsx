import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessPlan } from "@/lib/types";
import { createPlan, deletePlan, updatePlan } from "../../../../actions";

export default async function PlansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: plans } = await db
    .from("business_plans")
    .select("*")
    .eq("tenant_id", id)
    .order("display_order", { ascending: true })
    .returns<BusinessPlan[]>();

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        Planos/assinaturas que o cliente vende no portal (aba Planos).
      </p>

      {(plans ?? []).map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-3">
            <form action={updatePlan.bind(null, id, p.id)} className="space-y-3">
              <PlanFields plan={p} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form action={deletePlan.bind(null, id, p.id)}>
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Excluir plano
              </button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent>
          <h2 className="mb-3 font-semibold">Novo plano</h2>
          <form action={createPlan.bind(null, id)} className="space-y-3">
            <PlanFields />
            <div className="flex justify-end">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanFields({ plan }: { plan?: BusinessPlan }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_auto_auto] gap-3">
        <Field label="Nome">
          <Input name="name" defaultValue={plan?.name ?? ""} required />
        </Field>
        <Field label="Preço/mês (R$)">
          <Input
            name="price_month"
            type="number"
            step="0.01"
            min={0}
            defaultValue={plan?.price_month ?? 0}
            className="w-32"
          />
        </Field>
        <Field label="Ordem">
          <Input
            name="display_order"
            type="number"
            defaultValue={plan?.display_order ?? 0}
            className="w-20"
          />
        </Field>
      </div>

      <Field label="Benefícios" hint="um por linha">
        <textarea
          name="benefits"
          rows={3}
          defaultValue={(plan?.benefits ?? []).join("\n")}
          placeholder={"2 limpezas/ano\nDesconto 20%"}
          className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--primary)]"
        />
      </Field>

      <div className="flex items-center gap-4">
        <Field label="Desconto upgrade (%)">
          <Input
            name="upgrade_discount_pct"
            type="number"
            min={0}
            max={100}
            defaultValue={plan?.upgrade_discount_pct ?? 0}
            className="w-24"
          />
        </Field>
        <label className="flex items-center gap-2 pt-5 text-sm">
          <input
            type="checkbox"
            name="is_popular"
            defaultChecked={plan?.is_popular ?? false}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Destaque (popular)
        </label>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal opacity-50">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
