import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import type { Reward } from "@/lib/types";

export function RewardFields({ reward }: { reward?: Reward }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Nome do prêmio">
          <Input name="name" defaultValue={reward?.name ?? ""} required />
        </Field>
        <Field label="Custo (pontos)">
          <Input
            name="points_cost"
            type="number"
            min={0}
            defaultValue={reward?.points_cost ?? 0}
            className="w-28"
          />
        </Field>
      </div>

      <Field label="Descrição">
        <Input
          name="description"
          defaultValue={reward?.description ?? ""}
          placeholder="opcional"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Imagem (URL)" hint="opcional">
          <Input name="image_url" defaultValue={reward?.image_url ?? ""} placeholder="https://..." />
        </Field>
        <Field label="Estoque" hint="vazio = ilimitado">
          <Input
            name="stock"
            type="number"
            min={0}
            defaultValue={reward?.stock ?? ""}
          />
        </Field>
        <Field label="Ordem">
          <Input
            name="display_order"
            type="number"
            defaultValue={reward?.display_order ?? 0}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={reward?.is_active ?? true}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        Ativo na loja
      </label>
    </>
  );
}
