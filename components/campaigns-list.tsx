"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { CampaignFields, type PlanOption } from "@/components/campaign-fields";
import type { Campaign, CampaignAudience, CampaignStats } from "@/lib/campaigns";
import type { TemplateCategory, WhatsAppTemplate } from "@/lib/whatsapp";
import { traduzirErro } from "@/lib/error-messages";

interface Previa {
  total: number;
  cobradas: number;
  gratuitas: number;
  totalBrl: number;
}

interface CampaignsListProps {
  campaigns: Campaign[];
  stats: Record<string, CampaignStats>;
  templates: WhatsAppTemplate[];
  plans: PlanOption[];
  conectado: boolean;
  createAction: (formData: FormData) => Promise<{ error?: string }>;
  updateAction: (campaignId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteAction: (campaignId: string) => Promise<{ error?: string }>;
  previewAction: (
    audience: CampaignAudience,
    categoria: TemplateCategory,
  ) => Promise<Previa>;
  startAction: (campaignId: string) => Promise<{ error?: string; total?: number }>;
  sendBatchAction: (campaignId: string) => Promise<{
    error?: string;
    enviadas?: number;
    falhas?: number;
    restantes?: number;
  }>;
  cancelAction: (campaignId: string) => Promise<{ error?: string }>;
}

const ESTILO_STATUS: Record<Campaign["status"], string> = {
  draft: "bg-black/10 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  sending: "bg-blue-500/10 text-blue-600",
  sent: "bg-green-500/10 text-green-600",
  canceled: "bg-red-500/10 text-red-600",
};

const ROTULO_STATUS: Record<Campaign["status"], string> = {
  draft: "Rascunho",
  sending: "Em disparo",
  sent: "Enviada",
  canceled: "Cancelada",
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CampaignsList(props: CampaignsListProps) {
  const { campaigns, conectado, templates } = props;
  const semTemplateAprovado = templates.every((t) => t.status !== "APPROVED");

  return (
    <div className="space-y-2">
      {!conectado && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          Conecte o WhatsApp do seu negócio acima para criar e disparar campanhas.
        </p>
      )}

      {conectado && semTemplateAprovado && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          Nenhum template aprovado na Meta ainda. Crie e envie pra aprovação em{" "}
          <strong>Gerenciador do WhatsApp &rarr; Modelos de mensagem</strong> —
          fora da janela de 24h a Meta só entrega template aprovado.
        </p>
      )}

      {campaigns.length === 0 ? (
        <p className="rounded-xl bg-black/5 px-3 py-2.5 text-sm opacity-70 dark:bg-white/10">
          Nenhuma campanha criada ainda.
        </p>
      ) : (
        campaigns.map((c) => <CampaignRow key={c.id} campaign={c} {...props} />)
      )}

      {conectado && !semTemplateAprovado && <NewCampaignForm {...props} />}
    </div>
  );
}

function NewCampaignForm({ createAction, templates, plans }: CampaignsListProps) {
  const [pendente, iniciar] = useTransition();

  return (
    <details className="group rounded-xl border border-dashed border-black/20 dark:border-white/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium">
        + Nova campanha
        <Icon
          name="chevronRight"
          className="h-4 w-4 shrink-0 opacity-50 transition group-open:rotate-90"
        />
      </summary>
      <div className="space-y-3 border-t border-black/10 px-4 py-4 dark:border-white/10">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            iniciar(async () => {
              const { error } = await createAction(formData);
              if (error) toast.error(traduzirErro(error));
              else {
                toast.success("Campanha criada como rascunho.");
                form.reset();
              }
            });
          }}
        >
          <CampaignFields templates={templates} plans={plans} />
          <div className="flex justify-end">
            <Button type="submit" disabled={pendente}>
              {pendente ? "Criando…" : "Criar campanha"}
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}

function CampaignRow({
  campaign: c,
  stats,
  templates,
  plans,
  updateAction,
  deleteAction,
  previewAction,
  startAction,
  sendBatchAction,
  cancelAction,
}: CampaignsListProps & { campaign: Campaign }) {
  const [salvando, iniciarSalvar] = useTransition();
  const [excluindo, iniciarExcluir] = useTransition();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregandoPrevia, iniciarPrevia] = useTransition();
  // null = sem disparo em andamento nesta aba.
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(
    null,
  );

  const s = stats[c.id];
  const enviadas = s ? s.sent + s.delivered + s.read : 0;

  const verPublico = () =>
    iniciarPrevia(async () => {
      setPrevia(await previewAction(c.audience ?? {}, c.template_category));
    });

  /**
   * Dispara em lotes até a fila zerar. O laço é aqui, no browser, de propósito:
   * cada lote é uma chamada curta, então uma lista grande não esbarra no tempo
   * limite da função — e fechar a aba só pausa (a fila fica no banco).
   */
  const disparar = async (continuando: boolean) => {
    const inicio = await startAction(c.id);
    if (inicio.error) {
      toast.error(traduzirErro(inicio.error));
      return;
    }

    const total = inicio.total ?? 0;
    setProgresso({ feitas: 0, total });
    if (!continuando) toast.success(`${total} destinatário(s) na fila.`);

    let feitas = 0;
    let falhas = 0;
    for (;;) {
      const lote = await sendBatchAction(c.id);
      if (lote.error) {
        toast.error(traduzirErro(lote.error));
        break;
      }
      feitas += lote.enviadas ?? 0;
      falhas += lote.falhas ?? 0;
      setProgresso({ feitas: feitas + falhas, total });
      if ((lote.restantes ?? 0) === 0) {
        toast.success(
          falhas > 0
            ? `Campanha enviada: ${feitas} entregue(s), ${falhas} falha(s).`
            : `Campanha enviada para ${feitas} cliente(s).`,
        );
        break;
      }
    }
    setProgresso(null);
  };

  const cancelar = () =>
    iniciarSalvar(async () => {
      const { error } = await cancelAction(c.id);
      if (error) toast.error(traduzirErro(error));
      else toast.success("Campanha cancelada.");
    });

  return (
    <div className="rounded-xl border border-black/10 bg-[var(--background)] dark:border-white/10">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-medium">{c.name}</span>
            <Badge className={ESTILO_STATUS[c.status]}>{ROTULO_STATUS[c.status]}</Badge>
          </div>
          {s && (
            <span className="hidden shrink-0 text-xs opacity-60 sm:inline">
              {enviadas}/{s.total} enviada(s)
              {s.failed > 0 && ` · ${s.failed} falha(s)`}
            </span>
          )}
          <Icon
            name="chevronRight"
            className="h-4 w-4 shrink-0 opacity-50 transition group-open:rotate-90"
          />
        </summary>

        <div className="space-y-3 border-t border-black/10 px-4 py-4 dark:border-white/10">
          {s && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Métrica rotulo="Na fila" valor={s.queued} />
              <Métrica rotulo="Enviadas" valor={s.sent + s.delivered + s.read} />
              <Métrica rotulo="Entregues" valor={s.delivered + s.read} />
              <Métrica rotulo="Lidas" valor={s.read} />
              <Métrica rotulo="Falhas" valor={s.failed} />
            </div>
          )}

          {progresso && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full bg-[var(--primary)] transition-all"
                  style={{
                    width: `${progresso.total ? (progresso.feitas / progresso.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs opacity-60">
                Enviando {progresso.feitas} de {progresso.total} — mantenha esta
                aba aberta.
              </p>
            </div>
          )}

          {c.status === "draft" ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                iniciarSalvar(async () => {
                  const { error } = await updateAction(c.id, formData);
                  if (error) toast.error(traduzirErro(error));
                  else {
                    toast.success("Campanha salva.");
                    setPrevia(null);
                  }
                });
              }}
            >
              <CampaignFields campaign={c} templates={templates} plans={plans} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5" disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar campanha"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="rounded-xl bg-black/5 px-3 py-2.5 text-sm dark:bg-white/10">
              <p className="whitespace-pre-wrap">{c.template_body}</p>
              <p className="mt-1 text-xs opacity-60">
                Template {c.template_name} · {c.template_category}
                {c.started_at &&
                  ` · disparada em ${new Date(c.started_at).toLocaleString("pt-BR")}`}
              </p>
            </div>
          )}

          {previa && (
            <p className="rounded-lg bg-black/5 px-3 py-2 text-xs dark:bg-white/10">
              <strong>{previa.total}</strong> cliente(s) recebem.{" "}
              {previa.gratuitas > 0 && `${previa.gratuitas} sem custo (janela de 24h). `}
              Custo estimado: <strong>{brl(previa.totalBrl)}</strong> —{" "}
              {previa.cobradas} mensagem(ns) cobrada(s) pela Meta. Valor
              aproximado; a cobrança real é a da sua conta na Meta.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {c.status === "draft" && (
              <>
                <Button
                  type="button"
                  className="px-3 py-1.5 text-xs"
                  onClick={verPublico}
                  disabled={carregandoPrevia}
                >
                  {carregandoPrevia ? "Calculando…" : "Ver público e custo"}
                </Button>
                <Button
                  type="button"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => disparar(false)}
                  disabled={!!progresso}
                >
                  {progresso ? "Disparando…" : "Disparar campanha"}
                </Button>
              </>
            )}

            {c.status === "sending" && (
              <>
                <Button
                  type="button"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => disparar(true)}
                  disabled={!!progresso}
                >
                  {progresso ? "Disparando…" : "Continuar disparo"}
                </Button>
                <button
                  type="button"
                  onClick={cancelar}
                  disabled={salvando || !!progresso}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Cancelar disparo
                </button>
              </>
            )}

            {c.status !== "sending" && (
              <button
                type="button"
                onClick={() =>
                  iniciarExcluir(async () => {
                    const { error } = await deleteAction(c.id);
                    if (error) toast.error(traduzirErro(error));
                  })
                }
                disabled={excluindo}
                className="ml-auto text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                {excluindo ? "Excluindo…" : "Excluir campanha"}
              </button>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

function Métrica({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg bg-black/5 px-3 py-2 dark:bg-white/10">
      <p className="text-lg font-semibold">{valor}</p>
      <p className="text-xs opacity-60">{rotulo}</p>
    </div>
  );
}
