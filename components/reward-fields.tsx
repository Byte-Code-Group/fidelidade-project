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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Imagem" hint="opcional">
          <div className="flex items-center gap-3">
            {reward?.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={reward.image_url}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
            )}
            <input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-white/10"
            />
          </div>
        </Field>
        <Field label="Estoque" hint="vazio = ilimitado">
          <Input
            name="stock"
            type="number"
            min={0}
            defaultValue={reward?.stock ?? ""}
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
