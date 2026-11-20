import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { precisaVerificarMfa } from "@/lib/mfa";

// A página é client; o guard da verificação em duas etapas fica aqui: com ela
// ativa, o GoTrue só troca a senha depois do código.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (user && (await precisaVerificarMfa(user))) redirect("/superadmin/verificar?next=/superadmin/redefinir-senha");
  return children;
}
