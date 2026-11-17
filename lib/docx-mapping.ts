/**
 * Mapeamento de campos num .docx, direto no XML (word/document.xml).
 *
 * O Word quebra o texto de um parágrafo em vários <w:t> (um por trecho de
 * formatação), então "Maria da Silva" pode estar espalhado em 3 nós. Aqui o
 * parágrafo é tratado como uma string contínua; o {{ campo }} entra no nó
 * onde o trecho começa (herda a formatação dele) e o resto do trecho sai dos
 * nós seguintes. Layout, estilos e o resto do arquivo ficam intactos.
 *
 * Sem dependência de browser: recebe um Document do DOMParser (ou xmldom).
 */
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

export const FIELD_REGEX = /\{\{\s*([\w]+)\s*\}\}/g;

/** Compara parágrafos ignorando espaços e tabs (o preview desenha tab como  ). */
export const normText = (s: string) => s.replace(/\s/g, "");

export interface MapOp {
  /** Texto normalizado do parágrafo + qual deles é, entre os de texto igual. */
  paraText: string;
  paraRank: number;
  /** replace: trecho selecionado. after: trecho logo antes do cursor. */
  text: string;
  /** Qual ocorrência de `text` dentro do parágrafo. */
  nth: number;
  mode: "replace" | "after";
  field: string;
}

function hasAncestor(node: Node, test: (el: Element) => boolean, stopAt?: Node) {
  for (let n = node.parentNode; n && n !== stopAt; n = n.parentNode) {
    if (n.nodeType === 1 && test(n as Element)) return true;
  }
  return false;
}

// mc:Fallback repete o conteúdo do mc:Choice (caixas de texto) — conta uma vez só.
const inFallback = (n: Node) => hasAncestor(n, (el) => el.localName === "Fallback");

function ownerParagraph(n: Node): Node | null {
  for (let p = n.parentNode; p; p = p.parentNode) {
    if (p.nodeType === 1 && (p as Element).localName === "p" && (p as Element).namespaceURI === W) return p;
  }
  return null;
}

function paragraphRuns(p: Element): Element[] {
  return Array.from(p.getElementsByTagNameNS(W, "t")).filter((t) => ownerParagraph(t) === p && !inFallback(t));
}

const runsText = (runs: Element[]) => runs.map((t) => t.textContent ?? "").join("");

function bodyParagraphs(doc: Document): Element[] {
  return Array.from(doc.getElementsByTagNameNS(W, "p")).filter((p) => !inFallback(p));
}

/** Índice da n-ésima ocorrência (conta sobrepostas, igual ao countBefore). */
function nthIndexOf(hay: string, needle: string, nth: number) {
  if (!needle) return nth === 0 ? 0 : -1;
  let idx = -1;
  for (let i = 0; i <= nth; i++) {
    idx = hay.indexOf(needle, idx + 1);
    if (idx < 0) return -1;
  }
  return idx;
}

/** Quantas ocorrências de `needle` começam antes de `limit`. */
export function countBefore(hay: string, needle: string, limit: number) {
  if (!needle) return 0;
  let count = 0;
  for (let idx = hay.indexOf(needle); idx >= 0 && idx < limit; idx = hay.indexOf(needle, idx + 1)) count++;
  return count;
}

/** Aplica um mapeamento. false = não achou o trecho no XML (nada muda). */
export function applyMapOp(doc: Document, op: MapOp): boolean {
  const same = bodyParagraphs(doc).filter((p) => normText(runsText(paragraphRuns(p))) === op.paraText);
  const p = same[op.paraRank];
  if (!p) return false;

  const runs = paragraphRuns(p);
  const idx = nthIndexOf(runsText(runs), op.text, op.nth);
  if (!runs.length || idx < 0) return false;

  const start = op.mode === "replace" ? idx : idx + op.text.length;
  const end = op.mode === "replace" ? idx + op.text.length : start;
  const placeholder = `{{ ${op.field} }}`;

  let pos = 0;
  let placed = false;
  for (const t of runs) {
    const s = t.textContent ?? "";
    const tStart = pos;
    const tEnd = pos + s.length;
    pos = tEnd;

    // Inserção no fim de um nó herda a formatação de quem vem antes; troca
    // começa no nó onde o trecho começa.
    const startsHere = start >= tStart && (end === start ? start <= tEnd : start < tEnd);
    if (!placed && startsHere) {
      t.textContent = s.slice(0, start - tStart) + placeholder + (end <= tEnd ? s.slice(end - tStart) : "");
      t.setAttributeNS(XML_NS, "xml:space", "preserve");
      placed = true;
    } else if (placed && tStart < end) {
      t.textContent = end >= tEnd ? "" : s.slice(end - tStart);
      t.setAttributeNS(XML_NS, "xml:space", "preserve");
    }
    if (placed && tEnd >= end) break;
  }
  return placed;
}

/** Chaves {{ campo }} presentes no documento, na ordem em que aparecem. */
export function mappedFields(doc: Document): string[] {
  const keys = new Set<string>();
  for (const p of bodyParagraphs(doc)) {
    for (const m of runsText(paragraphRuns(p)).matchAll(FIELD_REGEX)) keys.add(m[1]);
  }
  return [...keys];
}
