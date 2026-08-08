"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/section";
import type { Campaign, CampaignVariable, VariableSource } from "@/lib/campaigns";
import type { WhatsAppTemplate } from "@/lib/whatsapp";

export interface PlanOption {
  id: string;
  name: string;
}

const FONTES: [VariableSource, string][] = [
  ["first_name", "Primeiro nome do cliente"],
  ["full_name", "Nome completo do cliente"],
  ["points", "Pontos acumulados"],
  ["member_code", "Código da carteirinha"],
  ["plan_name", "Nome do plano"],
  ["business_name", "Nome do seu negócio"],
  ["literal", "Texto fixo"],
];

const EXEMPLO: Record<VariableSource, string> = {
  first_name: "Ana",
  full_name: "Ana Souza",
  points: "12",
  member_code: "ORAL-4F2A9C",
  plan_name: "Plano Ouro",
  business_name: "Seu negócio",
  literal: "",
};

/** Mesma substituição do envio, só que com valores de exemplo. */
function preencher(body: string, valores: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => valores[Number(n) - 1] || `{{${n}}}`);
}

function contarVariaveis(body: string): number {
  const achados = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return achados.length === 0 ? 0 : Math.max(...achados);
}

/**
 * Campos compartilhados por criar e editar campanha.
 *
 * Ao editar, o template não muda: trocar o template mudaria o número de
 * variáveis e a categoria (e com ela o custo) de uma campanha já revisada.
 */
export function CampaignFields({
  campaign,
  templates,
  plans,
}: {
  campaign?: Campaign;
  templates: WhatsAppTemplate[];
  plans: PlanOption[];
}) {
  const aprovados = templates.filter((t) => t.status === "APPROVED");
  const [templateName, setTemplateName] = useState(
    campaign?.template_name ?? aprovados[0]?.name ?? "",
  );

  // Ao editar, o corpo salvo é a verdade: o template pode ter sumido da Meta e
  // ainda assim precisamos mostrar o que foi enviado.
  const template = aprovados.find((t) => t.name === templateName);
  const body = campaign?.template_body ?? template?.body ?? "";
  const categoria = campaign?.template_category ?? template?.category ?? "MARKETING";
  const quantidade = contarVariaveis(body);

  const [variaveis, setVariaveis] = useState<CampaignVariable[]>(
    campaign?.variables ?? [],
  );

  const variavelEm = (i: number): CampaignVariable =>
    variaveis[i] ?? { source: "first_name" };

  const trocar = (i: number, patch: Partial<CampaignVariable>) =>
    setVariaveis((atual) => {
      const proximo = [...atual];
      while (proximo.length <= i) proximo.push({ source: "first_name" });
      proximo[i] = { ...proximo[i], ...patch };
      return proximo;
    });

  const previa = preencher(
    body,
    Array.from({ length: quantidade }, (_, i) => {
      const v = variavelEm(i);
      return v.source === "literal" ? (v.value ?? "") : EXEMPLO[v.source];
    }),
  );

  const aud = campaign?.audience ?? {};

  return (
    <div className="space-y-3">
      <Field label="Nome da campanha" hint="só você vê">
        <Input name="name" defaultValue={campaign?.name ?? ""} placeholder="Reativação de agosto" required />
      </Field>

      {campaign ? (
        <input type="hidden" name="template_name" value={campaign.template_name} />
      ) : (
        <Field
          label="Template aprovado"
          hint={aprovados.length === 0 ? "nenhum aprovado na Meta ainda" : undefined}
        >
          <Select
            name="template_name"
            value={templateName}
            onChange={(e) => {
              setTemplateName(e.target.value);
              setVariaveis([]);
            }}
            disabled={aprovados.length === 0}
          >
            {aprovados.length === 0 && <option value="">—</option>}
            {aprovados.map((t) => (
              <option key={`${t.name}:${t.language}`} value={t.name}>
                {t.name} ({t.language}) · {t.category}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {categoria === "MARKETING" ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Template de <strong>marketing</strong>: a Meta cobra por mensagem
          enviada, inclusive pra quem já está conversando com você.
        </p>
      ) : (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-400">
          Template <strong>{categoria === "UTILITY" ? "utility" : "de autenticação"}</strong>
          {categoria === "UTILITY"
            ? ": sai de graça pra quem falou com você nas últimas 24h."
            : ": cobrado por mensagem pela Meta."}
        </p>
      )}

      {quantidade > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Variáveis do template</p>
          {Array.from({ length: quantidade }, (_, i) => {
            const v = variavelEm(i);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs opacity-60">{`{{${i + 1}}}`}</span>
                <Select
                  name={`var_${i + 1}_source`}
                  value={v.source}
                  onChange={(e) =>
                    trocar(i, { source: e.target.value as VariableSource })
                  }
                >
                  {FONTES.map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </Select>
                <Input
                  name={`var_${i + 1}_value`}
                  value={v.source === "literal" ? (v.value ?? "") : ""}
                  onChange={(e) => trocar(i, { value: e.target.value })}
                  placeholder="texto fixo"
                  disabled={v.source !== "literal"}
                  className="disabled:opacity-40"
                />
              </div>
            );
          })}
        </div>
      )}

      {body && (
        <div>
          <p className="text-sm font-medium">Prévia</p>
          <p className="mt-1 whitespace-pre-wrap rounded-xl bg-[#dcf8c6] px-3 py-2 text-sm text-gray-900">
            {previa}
          </p>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-black/10 p-3 dark:border-white/10">
        <p className="text-sm font-medium">Quem recebe</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Situação da carteirinha">
            <Select name="aud_status" defaultValue={aud.status ?? ""}>
              <option value="">Todas</option>
              <option value="active">Ativa</option>
              <option value="expired">Vencida</option>
              <option value="suspended">Suspensa</option>
            </Select>
          </Field>
          <Field label="Plano">
            <Select name="aud_plan" defaultValue={aud.planId ?? ""}>
              <option value="">Qualquer</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pontos — mínimo">
            <Input
              name="aud_min_points"
              type="number"
              min={0}
              defaultValue={aud.minPoints ?? ""}
              placeholder="sem mínimo"
            />
          </Field>
          <Field label="Pontos — máximo">
            <Input
              name="aud_max_points"
              type="number"
              min={0}
              defaultValue={aud.maxPoints ?? ""}
              placeholder="sem máximo"
            />
          </Field>
          <Field label="Parado há (dias)" hint="sem check-in">
            <Input
              name="aud_inactive_days"
              type="number"
              min={0}
              defaultValue={aud.inactiveDays ?? ""}
              placeholder="qualquer"
            />
          </Field>
        </div>
        <p className="text-xs text-gray-500">
          Quem não tem telefone cadastrado ou pediu pra sair nunca entra na
          lista, independente dos filtros.
        </p>
      </div>
    </div>
  );
}
