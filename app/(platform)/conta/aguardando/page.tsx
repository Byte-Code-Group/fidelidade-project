"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Rota alcançada pelo redirect de volta do checkout Asaas (navegação
// cross-site). O cookie de sessão pode não chegar na 1ª renderização —
// por isso a checagem de auth/status é feita via fetch client-side
// (same-site) em vez de gate no server component.
export default function AguardandoPage() {
  return (
    <Suspense>
      <AguardandoContent />
    </Suspense>
  );
}

function AguardandoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modo = searchParams.get("modo");
  const [checking, setChecking] = useState(true);

  // Retorna true quando já redirecionou — aí não faz sentido seguir olhando.
  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/conta/status", { cache: "no-store" });

      // 401 = sessão expirada por tempo (middleware). O reload cai no
      // middleware de novo, que redireciona pro login.
      if (res.status === 401) {
        window.location.reload();
        return true;
      }

      const data: {
        authenticated: boolean;
        tenantStatus: string | null;
        anyActive?: boolean;
      } = await res.json();

      if (!data.authenticated) {
        router.replace("/conta/login");
        return true;
      }
      if (data.tenantStatus === "active" || data.anyActive) {
        router.replace("/painel");
        return true;
      }
    } catch {
      // Rede instável no retorno do checkout: silencia e tenta no próximo ciclo.
    }
    return false;
  }, [router]);

  // A ativação vem por webhook do Asaas, que pode levar alguns segundos —
  // consulta em intervalo pra que o portal abra sozinho, sem o dono precisar
  // clicar em "Verificar status".
  useEffect(() => {
    let stopped = false;

    const run = async () => {
      const redirected = await checkStatus();
      if (stopped) return;
      if (redirected) {
        stopped = true;
        clearInterval(timer);
        return;
      }
      setChecking(false);
    };

    const timer = setInterval(run, 5000);
    void run();

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [checkStatus]);

  const handleManualCheck = async () => {
    setChecking(true);
    const redirected = await checkStatus();
    if (!redirected) setChecking(false);
  };

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
              onClick={handleManualCheck}
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
