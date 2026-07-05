import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { ValidationsList, type CompletionRow } from "@/components/validations-list";
import { ownerApproveMissionCompletion, ownerRejectMissionCompletion } from "../actions";

export default async function OwnerValidationsPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();
  const { data: completions } = await db
    .from("mission_completions")
    .select("*, users!mission_completions_user_id_fkey(full_name, email), missions(title, points)")
    .eq("tenant_id", tenantId)
    .order("completed_at", { ascending: false })
    .returns<CompletionRow[]>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Validações</h1>
      </div>
      <ValidationsList
        completions={completions ?? []}
        approveAction={ownerApproveMissionCompletion}
        rejectAction={ownerRejectMissionCompletion}
      />
    </div>
  );
}
