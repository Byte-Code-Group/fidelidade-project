import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { MissionFields } from "@/components/mission-fields";
import type { Mission } from "@/lib/types";
import { ownerCreateMission, ownerDeleteMission, ownerUpdateMission } from "../actions";

export default async function OwnerMissionsPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();
  const { data: missions } = await db
    .from("missions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .returns<Mission[]>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Missões</h1>
        <p className="mt-1 text-sm text-gray-500">
          Missões que aparecem no portal de Engajamento do cliente.
        </p>
      </div>

      {(missions ?? []).map((m) => (
        <Card key={m.id}>
          <CardContent className="space-y-3">
            <form
              action={ownerUpdateMission.bind(null, m.id)}
              className="space-y-3"
            >
              <MissionFields mission={m} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form action={ownerDeleteMission.bind(null, m.id)}>
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
          <form action={ownerCreateMission} className="space-y-3">
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
