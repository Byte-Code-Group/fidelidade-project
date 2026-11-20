"use client";
import { Icon } from "@/components/icons";

import Link from "next/link";

// Tela de erro compartilhada pelos error.tsx de cada segmento — o que muda
// entre painel, portal e superadmin é só o link de volta.
export function ErrorView({
  error,
  reset,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref: string;
  homeLabel: string;
}) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 ring-1 ring-red-500/15">
          <Icon name="alert" className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted">
          Não foi possível carregar esta página. Tente novamente em instantes.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-muted">
            Código: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 space-y-3">
          <button
            onClick={reset}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Tentar novamente
          </button>
          <Link
            href={homeHref}
            className="block text-sm text-muted hover:underline"
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

// Mesmo layout, para rotas inexistentes.
export function NotFoundView({
  homeHref,
  homeLabel,
}: {
  homeHref: string;
  homeLabel: string;
}) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/15">
          <Icon name="searchX" className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted">
          O endereço acessado não existe ou foi movido.
        </p>
        <Link
          href={homeHref}
          className="mt-6 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
