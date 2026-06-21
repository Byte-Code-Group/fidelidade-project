import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Reward } from "@/lib/types";
import { createReward, deleteReward, updateReward } from "../../../../actions";

export default async function RewardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: rewards } = await db
    .from("rewards")
    .select("*")
    .eq("tenant_id", id)
    .order("display_order", { ascending: true })
    .returns<Reward[]>();

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        Prêmios que o cliente troca por pontos na Loja de Resgate do portal.
      </p>

      {(rewards ?? []).map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-3">
            <form action={updateReward.bind(null, id, r.id)} className="space-y-3">
              <RewardFields reward={r} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form action={deleteReward.bind(null, id, r.id)}>
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Excluir prêmio
              </button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent>
          <h2 className="mb-3 font-semibold">Novo prêmio</h2>
          <form action={createReward.bind(null, id)} className="space-y-3">
            <RewardFields />
            <div className="flex justify-end">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function RewardFields({ reward }: { reward?: Reward }) {
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
