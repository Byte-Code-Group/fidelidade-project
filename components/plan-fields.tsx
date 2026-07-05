import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import type { BusinessPlan } from "@/lib/types";

export function PlanFields({ plan }: { plan?: BusinessPlan }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-3">
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
