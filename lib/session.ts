import "server-only";
import { cookies } from "next/headers";
import { SESSION_START_PUBLIC_COOKIE } from "@/lib/session-limits";

// Quando a sessão atual começou (ms). O cookie é escrito pelo middleware;
// na primeira request logo após o login ele ainda não voltou do browser, daí
// o fallback "agora" — quem decide a expiração é o middleware, não isso.
export async function getSessionStartedAt(): Promise<number> {
  const raw = (await cookies()).get(SESSION_START_PUBLIC_COOKIE)?.value;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : Date.now();
}
