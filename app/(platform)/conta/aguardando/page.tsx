"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Rota alcançada pelo redirect de volta do checkout Asaas (navegação
// cross-site). O cookie de sessão pode não chegar na 1ª renderização —
// por isso a checagem de auth/status é feita via fetch client-side
// (same-site) em vez de gate no server component.
export default function AguardandoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modo = searchParams.get("modo");
  const [checking, setChecking] = useState(true);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/conta/status", { cache: "no-store" });
      const data: { authenticated: boolean; tenantStatus: string | null } =
        await res.json();

      if (!data.authenticated) {
        router.replace("/conta/login");
        return;
      }
      if (data.tenantStatus === "active") {
        router.replace("/painel");
        return;
      }
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardContent className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 text-2xl">
            ⏳
          </div>
          <h1 className="text-xl font-bold">Aguardando confirmação</h1>
          <p className="mt-2 text-sm text-gray-500">
            {modo === "sem_asaas"
              ? "Pagamento em processamento. Entraremos em contato para confirmar sua assinatura."
              : "Assim que o pagamento for confirmado, seu portal será ativado automaticamente. Verifique seu e-mail."}
          </p>
          <div className="mt-6 space-y-3">
            <Button
              className="w-full"
              variant="outline"
              onClick={checkStatus}
              disabled={checking}
            >
              {checking ? "Verificando..." : "Verificar status"}
            </Button>
            <Link href="/conta/planos" className="block text-sm text-gray-400 hover:underline">
              Voltar aos planos
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
