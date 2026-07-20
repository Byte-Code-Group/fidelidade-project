"use client";

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
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
          ⚠️
        </div>
        <h1 className="text-lg font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-gray-500">
          Não foi possível carregar esta página. Tente novamente em instantes.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-gray-400">
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
            className="block text-sm text-gray-400 hover:underline"
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
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
          🔍
        </div>
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-gray-500">
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
