"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { traduzirErro } from "@/lib/error-messages";
import { fieldSlug, type DocFieldGroup } from "@/lib/document-fields";
import { applyMapOp, countBefore, FIELD_REGEX, mappedFields, normText, type MapOp } from "@/lib/docx-mapping";
import { readPageShapes, type PageShapes } from "@/lib/docx-shapes";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_XML = "word/document.xml";
const TAB = / /g; // o preview desenha <w:tab> como &emsp;, que não existe no XML

type Target = Omit<MapOp, "field"> & { preview: string };

interface DocxMapperProps {
  templateId: string;
  name: string;
  fileName: string;
  fileUrl: string;
  groups: DocFieldGroup[];
  updateAction: (templateId: string, formData: FormData) => Promise<{ error?: string }>;
}

// Lê a seleção do preview e descreve onde ela está em termos que o XML entende
// (parágrafo + ocorrência do trecho) — ver applyMapOp.
function readTarget(root: HTMLElement): Target | null | "multi" {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const article = root.querySelector("article");
  if (!article || !article.contains(range.startContainer)) return null;

  const el = (n: Node) => (n.nodeType === 1 ? (n as Element) : n.parentElement);
  const p = el(range.startContainer)?.closest("p");
  if (!p || !article.contains(p)) return null;
  if (el(range.endContainer)?.closest("p") !== p) return "multi";

  const before = document.createRange();
  before.setStart(p, 0);
  before.setEnd(range.startContainer, range.startOffset);
  const pre = before.toString().replace(TAB, "");

  const paraText = normText(p.textContent ?? "");
  const paraRank = Array.from(article.querySelectorAll("p"))
    .slice(0, Array.from(article.querySelectorAll("p")).indexOf(p))
    .filter((q) => normText(q.textContent ?? "") === paraText).length;

  if (range.collapsed) {
    const text = pre.slice(-20);
    return {
      paraText,
      paraRank,
      text,
      nth: Math.max(0, countBefore(pre, text, pre.length) - 1),
      mode: "after",
      preview: "",
    };
  }
  const text = range.toString().replace(TAB, "");
  if (!text.trim()) return null;
  return {
    paraText,
    paraRank,
    text,
    nth: countBefore(pre + text, text, pre.length),
    mode: "replace",
    preview: text,
  };
}

// Destaca os {{ campo }} já mapeados no preview. Não muda o texto (a seleção
// depende de textContent bater com o XML), só embrulha em <mark>.
function highlightFields(root: HTMLElement, labels: Map<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    if (t.data.includes("{{")) nodes.push(t);
  }
  for (const node of nodes) {
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of node.data.matchAll(FIELD_REGEX)) {
      frag.append(node.data.slice(last, m.index));
      const mark = document.createElement("mark");
      mark.className = "docx-field";
      mark.title = labels.get(m[1]) ?? "Campo próprio";
      mark.textContent = m[0];
      frag.append(mark);
      last = m.index + m[0].length;
    }
    if (last === 0) continue;
    frag.append(node.data.slice(last));
    node.replaceWith(frag);
  }
}

// Formas vetoriais do cabeçalho/rodapé (logo, ondas) que o docx-preview não desenha.
function drawPageShapes(view: HTMLElement, shapes: PageShapes | null) {
  if (!shapes) return;
  const pushTo = Math.max(0, ...shapes.header.filter((s) => s.pushesText).map((s) => s.top + s.height));
  for (const page of view.querySelectorAll<HTMLElement>("section.docx")) {
    const header = page.querySelector<HTMLElement>(":scope > header");
    if (header && pushTo > shapes.headerDistance) header.style.paddingTop = `${pushTo - shapes.headerDistance}pt`;
    for (const s of [...shapes.header, ...shapes.footer]) {
      const div = document.createElement("div");
      div.className = "docx-shape";
      div.style.cssText = `left:${s.left}pt;top:${s.top}pt;width:${s.width}pt;height:${s.height}pt`;
      div.innerHTML = s.svg;
      page.prepend(div);
    }
  }
}

// Página do Word tem largura fixa; encolhe pra caber na coluna sem rolar de lado.
function fitToWidth(view: HTMLElement) {
  const wrapper = view.querySelector<HTMLElement>(".docx-wrapper");
  const page = wrapper?.querySelector<HTMLElement>("section.docx");
  if (!wrapper || !page) return;
  wrapper.style.zoom = "1";
  wrapper.style.zoom = String(Math.min(1, (view.clientWidth - 32) / page.offsetWidth));
}

export function DocxMapper({ templateId, name, fileName, fileUrl, groups, updateAction }: DocxMapperProps) {
  const router = useRouter();
  const viewRef = useRef<HTMLDivElement>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [history, setHistory] = useState<ArrayBuffer[]>([]);
  const [used, setUsed] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [title, setTitle] = useState(name);
  const [custom, setCustom] = useState("");
  const [saving, startSaving] = useTransition();
  const dirty = history.length > 0 || title.trim() !== name;

  const labels = new Map(groups.flatMap((g) => g.fields.map((f) => [f.key, `${g.title} · ${f.label}`] as const)));

  useEffect(() => {
    fetch(fileUrl)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then(setBytes)
      .catch(() => setLoadError(true));
  }, [fileUrl]);

  // Redesenha o preview a cada versão do arquivo.
  useEffect(() => {
    const view = viewRef.current;
    if (!bytes || !view) return;
    let cancelled = false;
    (async () => {
      const { renderAsync } = await import("docx-preview");
      if (cancelled) return;
      await renderAsync(bytes, view, undefined, {
        className: "docx",
        inWrapper: true,
        breakPages: true,
        ignoreLastRenderedPageBreak: true,
        renderHeaders: true,
        renderFooters: true,
      });
      if (cancelled) return;
      highlightFields(view, labels);
      const zip = await JSZip.loadAsync(bytes);
      const parse = (x: string) => new DOMParser().parseFromString(x, "application/xml");
      const shapes = await readPageShapes(async (p) => zip.file(p)?.async("string"), parse);
      if (cancelled) return;
      drawPageShapes(view, shapes);
      fitToWidth(view);
      const xml = await zip.file(DOC_XML)?.async("string");
      if (xml && !cancelled) setUsed(mappedFields(parse(xml)));
    })().catch(() => setLoadError(true));
    return () => {
      cancelled = true;
    };
    // labels deriva de groups, que não muda durante a edição
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytes]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const ro = new ResizeObserver(() => fitToWidth(view));
    ro.observe(view);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onSelection = () => {
      const view = viewRef.current;
      if (!view) return;
      const t = readTarget(view);
      if (t === "multi") setTarget(null);
      else if (t) setTarget(t);
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function insertField(field: string) {
    if (!bytes) return;
    if (!target) {
      toast.info("Clique no documento onde o campo entra, ou selecione o texto que ele substitui.");
      return;
    }
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file(DOC_XML)?.async("string");
    if (!xml) return toast.error("Esse .docx não tem o corpo do documento.");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (!applyMapOp(doc, { ...target, field })) {
      toast.error("Não consegui marcar esse trecho. Tente selecionar só o texto, sem pegar tabulação ou quebra de página.");
      return;
    }
    zip.file(DOC_XML, new XMLSerializer().serializeToString(doc));
    const next = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
    setHistory((h) => [...h, bytes]);
    setBytes(next);
    setTarget(null);
    window.getSelection()?.removeAllRanges();
  }

  function undo() {
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setBytes(prev);
    setTarget(null);
  }

  function save() {
    if (!bytes) return;
    const fd = new FormData();
    fd.set("name", title.trim());
    fd.set("file", new File([bytes], fileName, { type: DOCX_MIME }));
    startSaving(async () => {
      const { error } = await updateAction(templateId, fd);
      if (error) return void toast.error(traduzirErro(error));
      toast.success("Modelo salvo. A IA já usa esses campos.");
      setHistory([]);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Nome do modelo"
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-semibold tracking-tight outline-none transition hover:border-line focus:border-[var(--primary)] dark:hover:border-white/15"
          />
          <button
            type="button"
            onClick={undo}
            disabled={!history.length || saving}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium opacity-70 transition hover:bg-surface-2 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/10"
          >
            <Icon name="history" className="h-4 w-4" />
            Desfazer
          </button>
          <Button type="button" onClick={save} disabled={!dirty || saving || !title.trim()}>
            {saving && <Spinner className="mr-2" />}
            {saving ? "Salvando…" : "Salvar modelo"}
          </Button>
        </div>

        <div
          ref={viewRef}
          className="docx-desk relative min-h-[60vh] overflow-x-auto rounded-2xl bg-[#e9ebef] p-4 dark:bg-white/[0.06]"
        >
          {!bytes && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm opacity-60">
              <Spinner /> Abrindo {fileName}…
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm opacity-70">
              Não consegui abrir o arquivo. Recarregue a página ou envie o .docx de novo.
            </div>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
        <div className="rounded-2xl border border-line bg-surface dark:border-white/10">
          <div className="border-b border-line p-4 dark:border-white/10">
            {target ? (
              target.mode === "replace" ? (
                <p className="text-sm">
                  Trocar <span className="rounded bg-[var(--primary)]/10 px-1 font-medium text-[var(--primary)]">
                    {target.preview.length > 40 ? `${target.preview.slice(0, 40)}…` : target.preview}
                  </span>{" "}
                  por qual campo?
                </p>
              ) : (
                <p className="text-sm">Escolha o campo que entra no cursor.</p>
              )
            ) : (
              <p className="text-sm opacity-70">
                Selecione no documento o texto de exemplo (nome, data, “______”) e escolha o dado que vai no
                lugar. Também dá pra clicar num ponto e inserir.
              </p>
            )}
          </div>

          {groups.map((g) => (
            <details key={g.id} open className="group border-b border-line last:border-0 dark:border-white/10">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
                {g.title}
                <Icon name="chevronRight" className="h-4 w-4 opacity-40 transition group-open:rotate-90" />
              </summary>
              <ul className="space-y-0.5 px-2 pb-3">
                {g.fields.map((f) => (
                  <li key={f.key}>
                    <button
                      type="button"
                      // mousedown sem foco: não perde a seleção no documento
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertField(f.key)}
                      disabled={!bytes}
                      className="group/f flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-[var(--primary)]/10 focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:opacity-40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{f.label}</span>
                        {f.example && <span className="block truncate text-xs opacity-50">{f.example}</span>}
                      </span>
                      {used.includes(f.key) ? (
                        <Icon name="check" className="h-4 w-4 text-[var(--primary)]" />
                      ) : (
                        <Icon name="plus" className="h-4 w-4 opacity-0 transition group-hover/f:opacity-60" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}

          <form
            className="space-y-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const key = fieldSlug(custom);
              if (!key) return;
              insertField(key).then(() => setCustom(""));
            }}
          >
            <label htmlFor="custom-field" className="block text-sm font-semibold">
              Campo próprio
            </label>
            <div className="flex gap-2">
              <input
                id="custom-field"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="ex: procedimento"
                className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)] dark:border-white/15"
              />
              <button
                type="submit"
                disabled={!custom.trim() || !bytes}
                className="rounded-lg border border-line px-3 text-sm font-medium transition hover:bg-surface-2 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/10"
              >
                Inserir
              </button>
            </div>
            <p className="text-xs opacity-50">A IA preenche com o que você escrever nas instruções ao gerar.</p>
          </form>
        </div>
      </aside>
    </div>
  );
}
