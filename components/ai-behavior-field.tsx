"use client";

import { useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_BEHAVIOR_MAX_LENGTH,
  pendingPlaceholders,
  presetsForModules,
  type BehaviorPreset,
} from "@/lib/ai/behavior-presets";

// Campo "Comportamento" da aba Assistente IA. O textarea é livre; os botões só
// colam receitas prontas (ver lib/ai/behavior-presets.ts) e o rodapé mostra o
// que ficou entre [COLCHETES] pro dono trocar pelos dados da clínica dele.
export function AiBehaviorField({
  defaultValue,
  modules,
}: {
  defaultValue: string;
  modules: Record<string, boolean>;
}) {
  const [value, setValue] = useState(defaultValue);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const presets = useMemo(() => presetsForModules(modules), [modules]);
  const pendentes = useMemo(() => pendingPlaceholders(value), [value]);

  // Título do snippet (1ª linha) identifica o bloco no texto — é por ele que
  // se sabe se o preset já está lá e o que remover ao desmarcar.
  const tituloDo = (p: BehaviorPreset) => p.snippet.split("\n")[0];
  const estaNoTexto = (p: BehaviorPreset) => value.includes(tituloDo(p));

  const aplicar = (textoNovo: string) => {
    setValue(textoNovo.slice(0, AI_BEHAVIOR_MAX_LENGTH));
    areaRef.current?.focus();
  };

  const inserir = (p: BehaviorPreset) => {
    const base = value.trimEnd();
    aplicar(base ? `${base}\n\n${p.snippet}` : p.snippet);
  };

  // Remove o bloco do preset: do título até a linha em branco seguinte (ou o
  // fim do texto). Edições dentro do bloco são preservadas até esse limite.
  const remover = (p: BehaviorPreset) => {
    const titulo = tituloDo(p);
    const inicio = value.indexOf(titulo);
    if (inicio < 0) return;
    const proximoBloco = value.indexOf("\n\n", inicio);
    const fim = proximoBloco < 0 ? value.length : proximoBloco + 2;
    aplicar((value.slice(0, inicio) + value.slice(fim)).trim());
  };

  return (
    <div className="space-y-2">
      <div>
        <span className="text-sm font-medium">Comportamento</span>
        <span className="ml-2 text-sm opacity-50">
          Instruções extras pra IA seguir nesta clínica (o que priorizar, o que
          evitar, jeito de conduzir a conversa). Some às regras fixas de
          segurança, nunca as substitui.
        </span>
      </div>

      <div className="rounded-lg bg-black/[0.03] p-3 dark:bg-white/5">
        <p className="mb-2 text-xs opacity-60">
          Comece por um modelo pronto e troque o que está entre [COLCHETES]
          pelos dados da clínica. Pode misturar vários, editar e apagar tudo à
          mão — o campo é livre.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const ativo = estaNoTexto(p);
            return (
              <button
                key={p.key}
                type="button"
                title={p.desc}
                aria-pressed={ativo}
                onClick={() => (ativo ? remover(p) : inserir(p))}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  ativo
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border-black/10 hover:border-[var(--primary)] hover:text-[var(--primary)] dark:border-white/15"
                }`}
              >
                {ativo ? "✓ " : "+ "}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <Textarea
        ref={areaRef}
        name="ai_behavior"
        rows={10}
        maxLength={AI_BEHAVIOR_MAX_LENGTH}
        className="font-mono text-xs leading-relaxed"
        placeholder="Ex: sempre pergunte se o cliente já é paciente antes de falar de preços; para dúvidas sobre pós-operatório, oriente a chamar a equipe direto pelo WhatsApp."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />

      <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
        {pendentes.length > 0 ? (
          <p className="flex-1 text-amber-700 dark:text-amber-400">
            Falta você preencher {pendentes.length}{" "}
            {pendentes.length === 1 ? "trecho" : "trechos"}:{" "}
            <span className="font-mono opacity-80">
              {pendentes.slice(0, 6).join(" · ")}
              {pendentes.length > 6 && ` · +${pendentes.length - 6}`}
            </span>
          </p>
        ) : (
          <p className="flex-1 opacity-50">
            {value.trim()
              ? "Nada pendente — nenhum [COLCHETE] sobrou no texto."
              : "Em branco: a IA segue só o comportamento padrão da plataforma."}
          </p>
        )}
        <span className="opacity-40">
          {value.length}/{AI_BEHAVIOR_MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
