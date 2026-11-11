import { Logo } from "@/components/logo";

// Moldura das telas de autenticação da plataforma (login, recuperação e
// redefinição de senha): painel de marca à esquerda, formulário à direita.
//
// `fixed inset-0` → tela cheia, escapa do nav/limite do (platform)/layout.
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
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
          <h2 className="text-3xl font-extrabold leading-tight">
            Fidelize seus clientes em minutos
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/85">
            Carteirinha digital, pontos e recompensas em um só portal com a cara
            do seu negócio.
          </p>
        </div>

        <p className="relative z-10 text-[13px] text-white/70">
          © {new Date().getFullYear()} Fidelidade
        </p>
      </div>

      {/* Conteúdo (direita) */}
      <div className="flex items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-sm flex-col gap-7">
          {/* Logo topo só no mobile (painel de marca fica oculto) */}
          <div className="flex items-center gap-2.5 text-gray-900 md:hidden">
            <Logo className="h-6 w-6" />
            <span className="text-xl font-extrabold">Fidelidade</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
