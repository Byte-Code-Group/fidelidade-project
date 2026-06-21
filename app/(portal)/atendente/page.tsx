import { notFound, redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { SofiaChat } from "./sofia-chat";

export default async function AtendentePage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();
  const { settings } = ctx;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const welcome =
    settings.ai_welcome_message ??
    "Posso te ajudar com agendamentos, dúvidas, documentos e muito mais.";

  return <SofiaChat aiName={settings.ai_name} welcome={welcome} />;
}
