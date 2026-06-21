import { Icon } from "@/components/icons";
import type { PortalNavItem } from "@/lib/portal-nav";

export interface PortalPreviewConfig {
  tenantName: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  themeMode: "light" | "dark";
  labelClient: string;
  memberName?: string;
  rewardName?: string | null;
  planLabel?: string;
  nav: PortalNavItem[];
}

// Preview fiel (não interativo) do portal do cliente, renderizado a partir de um
// config arbitrário — independente do tema da página do admin. Usado para mostrar
// "como é" um template e para pré-visualizar a personalização de uma empresa.
export function PortalPreview({ config }: { config: PortalPreviewConfig }) {
  const {
    tenantName,
    logoUrl,
    primaryColor,
    secondaryColor,
    themeMode,
    labelClient,
    memberName = "Nome do Cliente",
    rewardName,
    planLabel = "Plano",
    nav,
  } = config;

  const dark = themeMode === "dark";
  const mainBg = dark ? "#0d1726" : "#f1f5f9";
  const mainFg = dark ? "#e5edf5" : "#0f172a";
  const muted = dark ? "rgba(229,237,245,0.55)" : "rgba(15,23,42,0.55)";

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 shadow-sm">
      <div className="flex h-[360px] text-[11px]">
        {/* Sidebar */}
        <div className="flex w-[38%] flex-col border-r border-black/5 bg-white">
          <div className="flex items-center gap-2 px-3 py-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={tenantName}
                className="h-7 w-7 rounded-lg object-cover"
              />
            ) : (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ background: primaryColor }}
              >
                {tenantName.charAt(0) || "?"}
              </div>
            )}
            <div className="min-w-0 leading-tight">
              <p className="truncate font-bold text-slate-800">
                {tenantName || "Sua marca"}
              </p>
              <p className="truncate text-[8px] uppercase tracking-wider text-slate-400">
                Programa Fidelidade
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-0.5 px-2">
            {nav.map((item, i) => {
              const active = i === 0;
              return (
                <div
                  key={item.href}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-medium"
                  style={
                    active
                      ? { background: hexA(primaryColor, 0.12), color: primaryColor }
                      : { color: "rgba(15,23,42,0.6)" }
                  }
                >
                  <Icon name={item.icon} className="h-3.5 w-3.5" />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-hidden p-3" style={{ background: mainBg, color: mainFg }}>
          <p style={{ color: muted }}>Bem-vindo de volta,</p>
          <p className="text-sm font-bold">{memberName} 👋</p>

          {/* Carteirinha */}
          <div
            className="mt-2 overflow-hidden rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            }}
          >
            <div className="p-3 text-white">
              <p className="text-[9px] font-semibold uppercase tracking-wider">
                {tenantName || "Sua marca"}
              </p>
              <p className="mt-2 text-[8px] uppercase tracking-wider opacity-70">
                {labelClient}
              </p>
              <p className="text-sm font-bold leading-tight">{memberName}</p>
              <div className="mt-2 flex gap-3 text-[8px]">
                <span className="opacity-80">{planLabel}</span>
                <span className="opacity-80">• Titular</span>
                <span className="font-mono opacity-80">ORAL-0001</span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-green-600 px-3 py-1 text-[8px] text-white">
              <span>Validade: 63 dias</span>
              <span className="rounded-full bg-white/25 px-1.5 py-0.5">ATIVO</span>
            </div>
          </div>

          {/* Fidelidade */}
          <div
            className="mt-2 rounded-xl border p-2.5"
            style={{
              borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
              background: dark ? "rgba(255,255,255,0.04)" : "#ffffff",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{rewardName || "Programa Fidelidade"}</span>
              <span style={{ color: primaryColor }} className="font-bold">
                4/6
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: hexA(primaryColor, 0.15) }}>
              <div className="h-full rounded-full" style={{ width: "66%", background: primaryColor }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Cor hex (#rrggbb) com alpha → rgba(). Aceita já-rgba/var passando direto.
function hexA(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
