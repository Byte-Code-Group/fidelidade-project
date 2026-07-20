"use client";

// Última linha de defesa: só dispara se o próprio root layout quebrar, então
// precisa renderizar <html>/<body> por conta própria.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh items-center justify-center bg-gray-50 p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
            ⚠️
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            Algo deu errado
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Tivemos um problema inesperado. Tente novamente em instantes.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-xs text-gray-400">
              Código: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            className="mt-6 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
