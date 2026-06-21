import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
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
        emoji="✅"
        title="Check-in confirmado!"
        text={`+${settings.loyalty_points_per_checkin} ponto(s) na sua ${settings.label_client.toLowerCase()}.`}
        cta
      />
    );
  }
  if (error === "already") {
    return (
      <Feedback
        emoji="👍"
        title="Você já fez check-in"
        text="Seu check-in deste período já foi registrado. Volte no próximo!"
        cta
      />
    );
  }
  if (error === "invalid" || !token || token !== tenant.checkin_token) {
    return (
      <Feedback
        emoji="⚠️"
        title="QR inválido"
        text="Escaneie o QR Code oficial no balcão para fazer seu check-in."
      />
    );
  }
  if (error === "fail") {
    return (
      <Feedback
        emoji="😕"
        title="Não deu certo"
        text="Não foi possível registrar agora. Tente novamente."
      />
    );
  }

  // Precisa estar logado.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <Card>
        <CardContent className="text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="mt-2 text-lg font-semibold">Entre para confirmar</h1>
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
        emoji="👍"
        title="Você já fez check-in"
        text="Seu check-in deste período já foi registrado. Volte no próximo!"
        cta
      />
    );
  }

  // Confirmação (POST via Server Action).
  return (
    <Card>
      <CardContent className="text-center">
        <div className="text-4xl">📍</div>
        <h1 className="mt-2 text-lg font-semibold">
          Check-in na {tenant.name}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          Confirme sua presença e ganhe {settings.loyalty_points_per_checkin}{" "}
          ponto(s).
        </p>
        <form action={doCheckin.bind(null, token)} className="mt-4">
          <Button type="submit" className="w-full">
            Confirmar check-in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Feedback({
  emoji,
  title,
  text,
  cta,
}: {
  emoji: string;
  title: string;
  text: string;
  cta?: boolean;
}) {
  return (
    <Card>
      <CardContent className="text-center">
        <div className="text-4xl">{emoji}</div>
        <h1 className="mt-2 text-lg font-semibold">{title}</h1>
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
