import { getSessionStartedAt } from "@/lib/session";
import { SessionTimeout } from "@/components/session-timeout";

// Monte nos layouts autenticados (painel, portal do cliente, superadmin).
export async function SessionWatch() {
  const startedAt = await getSessionStartedAt();
  return <SessionTimeout startedAt={startedAt} />;
}
