import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Destino do link enviado no e-mail de recuperação. Troca o token de uso único
// por uma sessão (cookies só podem ser gravados em route handler / action) e
// manda pra tela de nova senha.
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");

  if (!tokenHash) {
    return NextResponse.redirect(
      new URL("/conta/esqueci-senha?error=link_invalido", req.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/conta/esqueci-senha?error=link_invalido", req.url),
    );
  }

  return NextResponse.redirect(new URL("/conta/redefinir-senha", req.url));
}
