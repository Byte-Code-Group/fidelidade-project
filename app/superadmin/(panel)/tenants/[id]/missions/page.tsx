import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { MissionFields } from "@/components/mission-fields";
import type { Mission } from "@/lib/types";
import { createMission, deleteMission, updateMission } from "../../../../actions";

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
              action={async (formData: FormData) => {
                "use server";
                await updateMission(id, m.id, formData);
              }}
              className="space-y-3"
            >
              <MissionFields mission={m} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form
              action={async () => {
                "use server";
                await deleteMission(id, m.id);
              }}
            >
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
          <form
            action={async (formData: FormData) => {
              "use server";
              await createMission(id, formData);
            }}
            className="space-y-3"
          >
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
