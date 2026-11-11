import Link from "next/link";
import { Logo } from "@/components/logo";
import { CadastroForm } from "@/components/cadastro-form";
import { FormError } from "@/components/ui/form-alert";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const bullets = [
    "Carteirinha digital com QR Code",
    "Pontos, recompensas e loja",
    "Atendente IA 24h",
  ];

  return (
    // fixed inset-0 → tela cheia, escapa do nav/limite do (platform)/layout.
    <div className="fixed inset-0 z-50 grid grid-cols-1 overflow-y-auto bg-white md:grid-cols-2">
      {/* Painel de marca (esquerda) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-blue-600 p-12 text-white md:flex">
        <div className="pointer-events-none absolute -right-44 -top-44 h-[480px] w-[480px] rounded-full border border-white/25" />
        <div className="pointer-events-none absolute -bottom-36 -left-24 h-[340px] w-[340px] rounded-full border border-white/25" />

        <div className="relative z-10 flex items-center gap-2.5">
          <Logo className="h-6 w-6 text-white" />
          <span className="text-xl font-extrabold">Fidelidade</span>
        </div>

        <div className="relative z-10 max-w-sm">
          <h2 className="mb-4 text-3xl font-extrabold leading-tight">
            Configure seu portal em minutos
          </h2>
          <ul className="flex flex-col gap-3.5 text-sm text-white/90">
            {bullets.map((b) => (
              <li key={b} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[13px] text-white/70">
          © {new Date().getFullYear()} Fidelidade
        </p>
      </div>

      {/* Formulário (direita) */}
      <div className="flex items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-sm flex-col gap-7">
          {/* Logo topo só no mobile (painel de marca fica oculto) */}
          <div className="flex items-center gap-2.5 text-gray-900 md:hidden">
            <Logo className="h-6 w-6" />
            <span className="text-xl font-extrabold">Fidelidade</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Crie sua conta</h1>
            <p className="mt-2 text-sm text-gray-500">
              Configure seu portal e ative com o plano que preferir.
            </p>
          </div>

          <FormError error={error} />

          <CadastroForm />

          <p className="text-center text-sm text-gray-500">
            Já tem conta?{" "}
            <Link href="/conta/login" className="font-semibold text-blue-600 hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
