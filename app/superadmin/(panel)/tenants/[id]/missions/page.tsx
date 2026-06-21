import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { SOCIAL_NETWORKS, isSocialKey } from "@/components/social-logos";
import type { Mission } from "@/lib/types";
import { createMission, deleteMission, updateMission } from "../../../../actions";

const TYPES = [
  ["custom", "Custom"],
  ["social_follow", "Seguir rede social"],
  ["review", "Avaliação"],
  ["referral", "Indicação"],
  ["checkin", "Check-in"],
] as const;

export default async function MissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: missions } = await db
    .from("missions")
    .select("*")
    .eq("tenant_id", id)
    .order("display_order", { ascending: true })
    .returns<Mission[]>();

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        Missões que aparecem no portal de Engajamento do cliente.
      </p>

      {(missions ?? []).map((m) => (
        <Card key={m.id}>
          <CardContent className="space-y-3">
            <form
              action={updateMission.bind(null, id, m.id)}
              className="space-y-3"
            >
              <MissionFields mission={m} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form action={deleteMission.bind(null, id, m.id)}>
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Excluir missão
              </button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent>
          <h2 className="mb-3 font-semibold">Nova missão</h2>
          <form action={createMission.bind(null, id)} className="space-y-3">
            <MissionFields />
            <div className="flex justify-end">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function MissionFields({ mission }: { mission?: Mission }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Título">
          <Input name="title" defaultValue={mission?.title ?? ""} required />
        </Field>
        <Field label="Pontos">
          <Input
            name="points"
            type="number"
            min={0}
            defaultValue={mission?.points ?? 0}
            className="w-24"
          />
        </Field>
      </div>

      <Field label="Descrição">
        <Input
          name="description"
          defaultValue={mission?.description ?? ""}
          placeholder="opcional"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Tipo">
          <Select name="type" defaultValue={mission?.type ?? "custom"}>
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rede social">
          <Select
            name="social"
            defaultValue={isSocialKey(mission?.icon) ? mission!.icon! : ""}
          >
            <option value="">Nenhuma</option>
            {SOCIAL_NETWORKS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ordem">
          <Input
            name="display_order"
            type="number"
            defaultValue={mission?.display_order ?? 0}
          />
        </Field>
      </div>

      <Field label="Ícone (emoji)" hint="usado se não for rede social">
        <Input
          name="icon"
          defaultValue={isSocialKey(mission?.icon) ? "" : (mission?.icon ?? "")}
          placeholder="🎯"
        />
      </Field>

      <Field label="URL externa" hint="opcional">
        <Input
          name="external_url"
          defaultValue={mission?.external_url ?? ""}
          placeholder="https://instagram.com/..."
        />
      </Field>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requires_validation"
            defaultChecked={mission?.requires_validation ?? false}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Exige validação
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={mission?.is_active ?? true}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Ativa
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
