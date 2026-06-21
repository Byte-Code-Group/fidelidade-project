import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "@/lib/types";
import { rotateCheckinToken } from "../../../../actions";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000";

export default async function CheckinTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("slug, checkin_token")
    .eq("id", id)
    .maybeSingle<Pick<Tenant, "slug" | "checkin_token">>();
  if (!tenant) notFound();

  const url = `http://${tenant.slug}.${ROOT_DOMAIN}/checkin?token=${tenant.checkin_token}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 256, margin: 1 });

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        Imprima/exiba este QR no balcão. O cliente escaneia, confirma presença e
        ganha pontos de fidelidade.
      </p>

      <Card>
        <CardContent className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR Code de check-in"
            className="h-56 w-56 rounded-lg border border-black/5"
          />
          <code className="break-all rounded-lg bg-black/5 px-3 py-2 text-center text-xs">
            {url}
          </code>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Rotacionar token</p>
            <p className="text-xs opacity-60">
              Gera um novo QR e invalida o anterior.
            </p>
          </div>
          <form action={rotateCheckinToken.bind(null, id)}>
            <Button variant="outline" type="submit" className="px-3 py-1.5">
              Gerar novo
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
