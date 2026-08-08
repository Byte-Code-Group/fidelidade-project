import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  LAST_ACTIVITY_COOKIE,
  SESSION_START_COOKIE,
  SESSION_START_PUBLIC_COOKIE,
} from "@/lib/session-limits";

// Destino do link enviado no e-mail de recuperação. Troca o token de uso único
// por uma sessão (cookies só podem ser gravados em route handler / action) e
// manda pra tela de nova senha.
//
// O proxy deixa /auth/* passar sem checar expiração — ver proxy.ts. E o
// redirect é o do next/navigation, não um NextResponse próprio: os cookies de
// sessão que o client da Supabase grava saem pelo cookie store da request, e
// uma resposta montada à mão não os carrega.
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");

  if (!tokenHash) {
    redirect("/conta/esqueci-senha?error=link_invalido");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (error) {
    console.error("[recuperar]", error.message);
    redirect("/conta/esqueci-senha?error=link_invalido");
  }

  // A sessão criada aqui é nova, mas os timestamps de rastreio da anterior
  // sobrevivem 30 dias — sem apagá-los, a request seguinte já cai como
  // "inatividade" e derruba a pessoa antes da troca de senha.
  const cookieStore = await cookies();
  for (const name of [
    SESSION_START_COOKIE,
    LAST_ACTIVITY_COOKIE,
    SESSION_START_PUBLIC_COOKIE,
  ]) {
    cookieStore.delete(name);
  }

  redirect("/conta/redefinir-senha");
}
