import { createAdminClient } from "@/lib/supabase/admin";
import { ValidationsList, type CompletionRow } from "@/components/validations-list";
import {
  approveMissionCompletion,
  rejectMissionCompletion,
} from "../../../../actions";

export default async function ValidationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: completions } = await db
    .from("mission_completions")
    .select("*, users(full_name, email), missions(title, points)")
    .eq("tenant_id", id)
    .order("completed_at", { ascending: false })
    .returns<CompletionRow[]>();

  return (
    <ValidationsList
      completions={completions ?? []}
      approveAction={approveMissionCompletion.bind(null, id)}
      rejectAction={rejectMissionCompletion.bind(null, id)}
    />
  );
}
