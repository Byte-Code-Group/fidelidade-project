"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { DocumentTemplateFields } from "@/components/document-template-fields";
import type { DocumentTemplate } from "@/lib/types";
import { traduzirErro } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

export type TemplateRowData = DocumentTemplate & { fieldCount: number };

type CreateAction = (formData: FormData) => Promise<{ error?: string; id?: string }>;
type UpdateAction = (templateId: string, formData: FormData) => Promise<{ error?: string }>;

interface DocumentTemplatesListProps {
  templates: TemplateRowData[];
  createAction: CreateAction;
  reorderAction: (orderedIds: string[]) => Promise<{ error?: string }>;
}

const extOf = (t: DocumentTemplate) => t.file_name?.split(".").pop()?.toLowerCase() ?? "txt";

// Lista reordenável por arrastar (handle ⠿) — mesmo padrão de missões/planos:
// a posição na lista É a ordem salva (display_order). Cada linha abre o modelo.
export function DocumentTemplatesList({ templates, createAction, reorderAction }: DocumentTemplatesListProps) {
  const [items, setItems] = useState(templates);
  const [prevTemplates, setPrevTemplates] = useState(templates);

  if (templates !== prevTemplates) {
    setPrevTemplates(templates);
    setItems(templates);
  }

  async function persistOrder(next: TemplateRowData[]) {
    setItems(next);
    const { error } = await reorderAction(next.map((t) => t.id));
    if (error) toast.error(traduzirErro(error));
  }

  return (
    <div className="space-y-6">
      <UploadDropzone createAction={createAction} compact={items.length > 0} />

      {items.length > 0 && (
        <Reorder.Group axis="y" values={items} onReorder={persistOrder} className="space-y-2">
          {items.map((t) => (
            <TemplateRow key={t.id} template={t} />
          ))}
        </Reorder.Group>
      )}

      <TextTemplateForm createAction={createAction} />
    </div>
  );
}

// Enviar o arquivo já cria o modelo (nome = nome do arquivo) e abre a edição.
function UploadDropzone({ createAction, compact }: { createAction: CreateAction; compact: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pending, startTransition] = useTransition();

  function upload(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.set("name", file.name.replace(/\.[^.]+$/, ""));
    fd.set("file", file);
    startTransition(async () => {
      const { error, id } = await createAction(fd);
      if (error || !id) return void toast.error(traduzirErro(error ?? "Não consegui criar o modelo."));
      router.push(`/painel/documentos/${id}`);
    });
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        upload(e.dataTransfer.files[0]);
      }}
      disabled={pending}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border-2 border-dashed px-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
        compact ? "py-4" : "flex-col justify-center py-14 text-center",
        over
          ? "border-[var(--primary)] bg-[var(--primary)]/5"
          : "border-black/15 hover:border-[var(--primary)]/60 hover:bg-[var(--primary)]/[0.03] dark:border-white/15",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]",
          compact ? "h-10 w-10" : "h-14 w-14",
        )}
      >
        {pending ? <Spinner /> : <Icon name="plus" className={compact ? "h-5 w-5" : "h-6 w-6"} />}
      </span>
      <span className="min-w-0">
        <span className={cn("block font-semibold", !compact && "text-lg")}>
          {pending ? "Enviando modelo…" : "Enviar modelo .docx"}
        </span>
        <span className="block text-sm opacity-60">
          Arraste o arquivo aqui ou clique pra escolher. Depois você marca onde entra cada dado.
        </span>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.pdf"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </button>
  );
}

// Miniatura de folha com a extensão — o que diferencia um modelo do outro de relance.
function PaperGlyph({ ext }: { ext: string }) {
  const tone =
    ext === "docx"
      ? "bg-[#2b579a] text-white"
      : ext === "pdf"
        ? "bg-[#c4302b] text-white"
        : "bg-black/60 text-white dark:bg-white/70 dark:text-black";
  return (
    <span className="relative block h-11 w-9 shrink-0 rounded-[3px] border border-black/15 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06)] dark:border-white/20 dark:bg-white/90">
      <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-bl-[3px] border-b border-l border-black/15 bg-black/[0.04]" />
      <span className="absolute left-1.5 right-2.5 top-3 h-px bg-black/15" />
      <span className="absolute left-1.5 right-1.5 top-[17px] h-px bg-black/15" />
      <span className="absolute left-1.5 right-3 top-[21px] h-px bg-black/15" />
      <span className={cn("absolute -left-1 bottom-1.5 rounded-[2px] px-1 text-[8px] font-bold leading-[13px]", tone)}>
        {ext.toUpperCase()}
      </span>
    </span>
  );
}

function TemplateRow({ template: t }: { template: TemplateRowData }) {
  const controls = useDragControls();
  const draggedRef = useRef(false);
  const ext = extOf(t);

  const status =
    t.fieldCount > 0 ? (
      <span className="text-[var(--primary)]">
        {t.fieldCount} {t.fieldCount === 1 ? "campo mapeado" : "campos mapeados"}
      </span>
    ) : ext === "docx" ? (
      <span className="text-amber-700 dark:text-amber-400">Nenhum campo mapeado — abra pra marcar</span>
    ) : (
      <span className="opacity-60">A IA reescreve o texto do modelo</span>
    );

  return (
    <Reorder.Item
      value={t}
      dragListener={false}
      dragControls={controls}
      className="rounded-xl border border-black/10 bg-[var(--background)] transition-colors hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
      onDragStart={() => {
        draggedRef.current = true;
      }}
      onDragEnd={() => {
        setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      }}
    >
      <div className="flex items-center gap-3 py-3 pl-2 pr-4">
        <span
          onPointerDown={(e) => controls.start(e)}
          aria-label="Arrastar pra reordenar"
          className="cursor-grab touch-none p-1 opacity-30 transition hover:opacity-70 active:cursor-grabbing"
        >
          <Icon name="gripVertical" className="h-4 w-4" />
        </span>
        <Link
          href={`/painel/documentos/${t.id}`}
          onClick={(e) => {
            if (draggedRef.current) e.preventDefault();
          }}
          className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
        >
          <PaperGlyph ext={ext} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{t.name}</span>
            <span className="block truncate text-sm">{status}</span>
          </span>
          <Icon name="chevronRight" className="h-4 w-4 opacity-40" />
        </Link>
      </div>
    </Reorder.Item>
  );
}

function TextTemplateForm({ createAction }: { createAction: CreateAction }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm opacity-60 transition hover:opacity-100">
        <Icon name="chevronRight" className="h-4 w-4 transition group-open:rotate-90" />
        Sem arquivo? Escreva o modelo em texto
      </summary>
      <form
        className="mt-3 space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          startTransition(async () => {
            const { error, id } = await createAction(formData);
            if (error || !id) return void toast.error(traduzirErro(error ?? "Não consegui criar o modelo."));
            toast.success("Modelo criado.");
            router.push(`/painel/documentos/${id}`);
          });
        }}
      >
        <DocumentTemplateFields />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Criando…" : "Criar modelo"}
          </Button>
        </div>
      </form>
    </details>
  );
}

/** Edição de modelo sem .docx (PDF ou texto colado): nome, arquivo e texto. */
export function DocumentTemplateEditor({
  template,
  updateAction,
}: {
  template: DocumentTemplate;
  updateAction: UpdateAction;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
        <p className="mt-1 max-w-prose text-sm opacity-60">
          Sem .docx, a IA reescreve o documento a partir deste texto. Pra manter o layout do seu arquivo e
          marcar os campos, envie o modelo em .docx.
        </p>
      </div>
      <form
        className="max-w-2xl space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          startTransition(async () => {
            const { error } = await updateAction(template.id, formData);
            if (error) return void toast.error(traduzirErro(error));
            toast.success("Modelo salvo.");
            router.refresh();
          });
        }}
      >
        <DocumentTemplateFields template={template} />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar modelo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
