import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Appointment } from "@/lib/types";
import {
  createAppointment,
  updateAppointmentStatus,
  deleteAppointment,
} from "../../../../actions";

interface AppointmentRow extends Appointment {
  users: { full_name: string | null; email: string | null } | null;
}

interface ClientOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

const statusStyle: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-600",
};

const statusLabel: Record<string, string> = {
  scheduled: "Agendado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const [{ data: appointments }, { data: clients }] = await Promise.all([
    db
      .from("appointments")
      .select("*, users!appointments_user_id_fkey(full_name, email)")
      .eq("tenant_id", id)
      .order("scheduled_at", { ascending: false })
      .returns<AppointmentRow[]>(),
    db
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", id)
      .eq("role", "client")
      .order("full_name", { ascending: true })
      .returns<ClientOption[]>(),
  ]);

  const upcoming = (appointments ?? []).filter((a) => a.status === "scheduled");
  const past = (appointments ?? []).filter((a) => a.status !== "scheduled");

  return (
    <div className="space-y-6">
      <p className="text-sm opacity-60">
        Gerencie os agendamentos dos clientes deste tenant.
      </p>

      {/* Novo agendamento */}
      <Card>
        <CardContent>
          <h2 className="mb-4 font-semibold">Novo agendamento</h2>
          {!clients || clients.length === 0 ? (
            <p className="text-sm opacity-50">
              Nenhum cliente cadastrado ainda.
            </p>
          ) : (
            <form
              action={createAppointment.bind(null, id)}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Cliente</span>
                  <Select name="user_id" required>
                    <option value="">Selecione...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name ?? c.email ?? c.id}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Título / tipo</span>
                  <Input
                    name="title"
                    required
                    placeholder="Consulta de retorno"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Data e hora</span>
                  <Input name="scheduled_at" type="datetime-local" required />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Observações</span>
                  <Input name="notes" placeholder="Opcional" />
                </label>
              </div>
              <div className="flex justify-end">
                <Button type="submit">Criar agendamento</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Próximos */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          Próximos ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <Card>
            <div className="px-5 py-8 text-center text-sm opacity-50">
              Nenhum agendamento futuro.
            </div>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-black/5">
              {upcoming.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs opacity-60">
                      {a.users?.full_name ?? a.users?.email ?? "—"} ·{" "}
                      {fmtDate(a.scheduled_at)}
                    </p>
                    {a.notes && (
                      <p className="mt-0.5 text-xs opacity-50">{a.notes}</p>
                    )}
                  </div>
                  <Badge className={statusStyle[a.status]}>
                    {statusLabel[a.status]}
                  </Badge>
                  <form
                    action={updateAppointmentStatus.bind(null, id, a.id, "completed")}
                  >
                    <Button type="submit" className="px-3 py-1.5 text-sm">
                      Concluir
                    </Button>
                  </form>
                  <form
                    action={updateAppointmentStatus.bind(null, id, a.id, "cancelled")}
                  >
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Cancelar
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Histórico */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold opacity-60">
            Histórico ({past.length})
          </h2>
          <Card>
            <div className="divide-y divide-black/5">
              {past.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-5 py-3.5 opacity-70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs opacity-60">
                      {a.users?.full_name ?? a.users?.email ?? "—"} ·{" "}
                      {fmtDate(a.scheduled_at)}
                    </p>
                  </div>
                  <Badge className={statusStyle[a.status] ?? "bg-black/5"}>
                    {statusLabel[a.status] ?? a.status}
                  </Badge>
                  <form action={deleteAppointment.bind(null, id, a.id)}>
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
