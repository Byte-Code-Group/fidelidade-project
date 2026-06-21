import { Badge } from "@/components/ui/badge";
import type { Membership, TenantContext } from "@/lib/types";

interface MembershipCardProps {
  membership: Membership;
  memberName: string;
  tenant: TenantContext;
  planName?: string | null;
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function MembershipCard({
  membership,
  memberName,
  tenant,
  planName,
}: MembershipCardProps) {
  const { tenant: t, settings } = tenant;
  const active = membership.status === "active";
  const validDays = daysUntil(membership.valid_until);
  const modalityLabel =
    membership.modality === "titular" ? "Titular" : "Dependente";

  return (
    <div className="overflow-hidden rounded-3xl text-white shadow-lg">
      {/* Corpo da carteirinha */}
      <div
        className="relative p-6"
        style={{
          background:
            "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
        }}
      >
        {/* círculos decorativos */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-6 bottom-2 h-28 w-28 rounded-full bg-white/5" />

        <div className="relative flex items-start justify-between">
          <p className="text-sm font-semibold uppercase tracking-wider">
            {t.name}
          </p>
          {planName && (
            <Badge className="bg-white/20 text-white backdrop-blur">
              Plano · {planName}
            </Badge>
          )}
        </div>

        <div className="relative mt-6">
          <p className="text-[11px] uppercase tracking-wider opacity-70">
            {settings.label_client}
          </p>
          <h2 className="mt-0.5 text-2xl font-bold">{memberName}</h2>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3 text-sm">
          <Field label="Plano" value={planName ?? "—"} />
          <Field label="Modalidade" value={modalityLabel} />
          <Field label="Código" value={membership.member_code} mono />
        </div>

        <p className="relative mt-5 text-xs opacity-70">
          Apresente este cartão digital ou físico na recepção.
        </p>
      </div>

      {/* Rodapé de status */}
      <div
        className={
          active
            ? "flex items-center justify-between bg-green-600 px-6 py-3 text-sm"
            : "flex items-center justify-between bg-black/40 px-6 py-3 text-sm"
        }
      >
        <span className="flex items-center gap-2 font-medium">
          {validDays !== null
            ? `Validade: ${validDays} dias`
            : "Sem prazo de validade"}
        </span>
        <Badge className="bg-white/25 text-white backdrop-blur">
          {active ? "ATIVO" : membership.status.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider opacity-60">{label}</p>
      <p className={mono ? "truncate font-mono font-medium" : "truncate font-medium"}>
        {value}
      </p>
    </div>
  );
}
