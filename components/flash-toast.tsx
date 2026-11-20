"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { traduzirErro } from "@/lib/error-messages";

// Mostra o resultado de uma action (?saved=1 / ?error=...) como toast e
// limpa a query string, pra não reaparecer num refresh da página.
export function FlashToast({
  error,
  saved,
  successMessage = "Alterações salvas.",
}: {
  error?: string;
  saved?: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Depende de error/saved: uma action que redireciona pra mesma página
  // (ex.: login errado → /conta/login?error=...) não remonta o componente.
  useEffect(() => {
    if (!error && !saved) return;
    let cancelled = false;
    // Microtask: no 1º load este effect roda antes do <Toaster> assinar o
    // store do sonner, e toast criado antes disso some.
    queueMicrotask(() => {
      if (cancelled) return;
      if (error) toast.error(traduzirErro(decodeURIComponent(error)));
      else toast.success(successMessage);
    });
    router.replace(pathname);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, saved]);

  return null;
}
