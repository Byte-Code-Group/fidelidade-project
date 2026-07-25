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

  useEffect(() => {
    if (error) {
      toast.error(traduzirErro(decodeURIComponent(error)));
      router.replace(pathname);
    } else if (saved) {
      toast.success(successMessage);
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
