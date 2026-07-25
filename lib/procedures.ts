import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { traduzirErro } from "@/lib/error-messages";
import type { Procedure } from "@/lib/types";

// Procedimentos oferecidos (consulta, limpeza, corte…). A duração do
// procedimento é o que define o tamanho do slot na agenda.

function camposDoProcedimento(formData: FormData) {
  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const precoRaw = String(formData.get("price") ?? "").trim();
  // Aceita "150", "150,50" e "R$ 150,50".
  const precoLimpo = precoRaw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const preco = precoLimpo === "" ? null : Math.round(Number(precoLimpo) * 100);

  return {
    name: String(formData.get("name") ?? "").trim(),
    description: texto("description"),
    duration_min: Number(formData.get("duration_min") ?? 30),
    price_cents: preco !== null && Number.isFinite(preco) && preco >= 0 ? preco : null,
    is_active: formData.get("is_active") === "on",
  };
}

function validar(campos: ReturnType<typeof camposDoProcedimento>): string | undefined {
  if (!campos.name) return "Informe o nome do procedimento.";
  if (!Number.isInteger(campos.duration_min) || campos.duration_min < 5 || campos.duration_min > 600) {
    return "A duração precisa estar entre 5 e 600 minutos.";
  }
  return undefined;
}

export async function insertProcedure(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const campos = camposDoProcedimento(formData);
  const invalido = validar(campos);
  if (invalido) return { error: invalido };

  const db = createAdminClient();
  const { count } = await db
    .from("procedures")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const { error } = await db
    .from("procedures")
    .insert({ tenant_id: tenantId, ...campos, display_order: count ?? 0 });
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function applyProcedureUpdate(
  tenantId: string,
  procedureId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const campos = camposDoProcedimento(formData);
  const invalido = validar(campos);
  if (invalido) return { error: invalido };

  const db = createAdminClient();
  const { error } = await db
    .from("procedures")
    .update(campos)
    .eq("id", procedureId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function removeProcedure(
  tenantId: string,
  procedureId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();

  const { count } = await db
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("procedure_id", procedureId)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString());

  if (count && count > 0) {
    return {
      error: `Este procedimento tem ${count} agendamento(s) futuro(s). Cancele ou remarque antes de excluir.`,
    };
  }

  const { error } = await db
    .from("procedures")
    .delete()
    .eq("id", procedureId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function reorderProcedures(
  tenantId: string,
  orderedIds: string[],
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from("procedures")
        .update({ display_order: index })
        .eq("id", id)
        .eq("tenant_id", tenantId),
    ),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error ? traduzirErro(failed.error.message) : undefined };
}

/**
 * Quais procedimentos um profissional atende. Lista vazia = atende todos —
 * assim um negócio de um único doutor não precisa configurar nada.
 */
export async function setProviderProcedures(
  tenantId: string,
  providerId: string,
  procedureIds: string[],
): Promise<{ error?: string }> {
  const db = createAdminClient();

  const { error: delErr } = await db
    .from("provider_procedures")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("provider_id", providerId);
  if (delErr) return { error: traduzirErro(delErr.message) };

  if (procedureIds.length === 0) return {};

  const { error } = await db.from("provider_procedures").insert(
    procedureIds.map((procedure_id) => ({
      tenant_id: tenantId,
      provider_id: providerId,
      procedure_id,
    })),
  );
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function listProcedures(
  tenantId: string,
  { somenteAtivos = false }: { somenteAtivos?: boolean } = {},
): Promise<Procedure[]> {
  const db = createAdminClient();
  let query = db
    .from("procedures")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true });
  if (somenteAtivos) query = query.eq("is_active", true);

  const { data } = await query.returns<Procedure[]>();
  return data ?? [];
}

export async function listProviderProcedures(
  tenantId: string,
): Promise<{ provider_id: string; procedure_id: string }[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("provider_procedures")
    .select("provider_id, procedure_id")
    .eq("tenant_id", tenantId)
    .returns<{ provider_id: string; procedure_id: string }[]>();
  return data ?? [];
}
