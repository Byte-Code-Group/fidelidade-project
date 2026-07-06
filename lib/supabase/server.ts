import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";

// Client de servidor (Server Components / Server Actions / Route Handlers).
// Usa os cookies da request → RLS ativo com a session do usuário.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // chamado de um Server Component — ignorável quando há middleware
            // cuidando do refresh de sessão.
          }
        },
      },
    },
  );
}

// auth.getUser() sempre revalida contra o servidor da Supabase (network,
// não é local como getClaims). Camadas diferentes (layout + page) chamam
// isso independente — cache() por request evita repetir o round-trip.
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
