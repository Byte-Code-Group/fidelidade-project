import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Fator TOTP já confirmado pelo usuário (vem do getUser, validado no servidor). */
export function fatorTotp(user: User) {
  return user.factors?.find((f) => f.factor_type === "totp" && f.status === "verified") ?? null;
}

/**
 * true se o usuário tem verificação em duas etapas ativa mas a sessão ainda
 * não passou pelo código (aal1). O access token lido aqui é o mesmo que o
 * getUser() acabou de validar no GoTrue nesta request.
 */
export const precisaVerificarMfa = cache(async (user: User): Promise<boolean> => {
  if (!fatorTotp(user)) return false;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return nivelDaSessao(session?.access_token) !== "aal2";
});

function nivelDaSessao(token: string | undefined): string | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).aal ?? null;
  } catch {
    return null;
  }
}
