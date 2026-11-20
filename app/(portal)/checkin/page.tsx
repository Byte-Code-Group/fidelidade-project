import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon, type IconKey } from "@/components/icons";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentPeriodRef, type LoyaltyFrequency } from "@/lib/loyalty";
import { doCheckin } from "../actions";

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string; error?: string }>;
}) {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();
  const { tenant, settings } = ctx;
  const { token, done, error } = await searchParams;

  // Sucesso
  if (done) {
    return (
      <Feedback
        icon="stamp"
        tone="success"
        title="Check-in confirmado!"
        text={`+${settings.loyalty_points_per_checkin} ponto(s) na sua ${settings.label_client.toLowerCase()}.`}
        cta
      />
    );
  }
  if (error === "already") {
    return (
      <Feedback
        icon="thumbsUp"
        tone="primary"
        title="Você já fez check-in"
        text="Seu check-in deste período já foi registrado. Volte no próximo!"
        cta
      />
    );
  }
  if (error === "invalid" || !token || token !== tenant.checkin_token) {
    return (
      <Feedback
        icon="alert"
        tone="warning"
        title="QR inválido"
        text="Escaneie o QR Code oficial no balcão para fazer seu check-in."
      />
    );
  }
  if (error === "fail") {
    return (
      <Feedback
        icon="alert"
        tone="danger"
        title="Não deu certo"
        text="Não foi possível registrar agora. Tente novamente."
      />
    );
  }

  // Precisa estar logado.
  const user = await getAuthUser();
  if (!user) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <StateIcon icon="lock" tone="primary" />
          <h1 className="mt-5 text-xl font-semibold">Entre para confirmar</h1>
          <p className="mt-1 text-sm opacity-70">
            Faça login e escaneie o QR novamente.
          </p>
          <Link href="/login" className="mt-4 block">
            <Button className="w-full">Entrar</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Já fez check-in neste período?
  const period = currentPeriodRef(
    (settings.loyalty_frequency as LoyaltyFrequency) ?? "monthly",
  );
  const db = createAdminClient();
  const { data: existing } = await db
    .from("checkins")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .eq("period_ref", period)
    .maybeSingle<{ id: string }>();

  if (existing) {
    return (
      <Feedback
        icon="thumbsUp"
        tone="primary"
        title="Você já fez check-in"
        text="Seu check-in deste período já foi registrado. Volte no próximo!"
        cta
      />
    );
  }

  // Confirmação (POST via Server Action).
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <StateIcon icon="mapPin" tone="primary" />
        <h1 className="mt-5 text-xl font-semibold">
          Check-in na {tenant.name}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          Confirme sua presença e ganhe {settings.loyalty_points_per_checkin}{" "}
          ponto(s).
        </p>
        <form action={doCheckin.bind(null, token)} className="mt-4">
          <Button type="submit" className="w-full" pendingLabel="Confirmando…">
            Confirmar check-in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const TONES = {
  success: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  primary: "bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/20",
  warning: "bg-amber-500/12 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400",
};

function StateIcon({ icon, tone }: { icon: IconKey; tone: keyof typeof TONES }) {
  return (
    <div
      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-8 ${TONES[tone]} ${
        tone === "success" ? "[animation:stamp_520ms_var(--ease-out)_both]" : "animate-rise"
      }`}
    >
      <Icon name={icon} className="h-7 w-7" />
    </div>
  );
}

function Feedback({
  icon,
  tone,
  title,
  text,
  cta,
}: {
  icon: IconKey;
  tone: keyof typeof TONES;
  title: string;
  text: string;
  cta?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <StateIcon icon={icon} tone={tone} />
        <h1 className="mt-5 text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm opacity-70">{text}</p>
        {cta && (
          <Link href="/engajamento" className="mt-4 block">
            <Button variant="outline" className="w-full">
              Ver fidelidade
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
