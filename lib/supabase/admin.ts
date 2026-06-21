import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client service-role — BYPASSA RLS. Usar SOMENTE em contextos server confiáveis
// (seed, webhooks, cron, leitura pública de branding antes do login). Nunca expor
// ao browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
