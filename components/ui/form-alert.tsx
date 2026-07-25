import { traduzirErro } from "@/lib/error-messages";

// Alerta inline das telas de autenticação (login, cadastro, senha).
// Fora do fluxo de auth o padrão é toast — ver `components/flash-toast.tsx`.
export function FormAlert({
  children,
  variant = "error",
}: {
  children: React.ReactNode;
  variant?: "error" | "success";
}) {
  if (!children) return null;

  const styles =
    variant === "error"
      ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
      : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400";

  return (
    <p role="alert" className={`rounded-lg px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

// Versão para o `?error=` da query string: decodifica e traduz.
export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return <FormAlert>{traduzirErro(decodeURIComponent(error))}</FormAlert>;
}
