import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

// Helvetica usa WinAnsi (cp1252): acentos do português entram, mas pontuação
// tipográfica fora do range (— “ ” → …) estoura no encode. Normaliza antes.
const REPLACEMENTS: Record<string, string> = {
  "—": "-", // em dash
  "–": "-", // en dash
  "•": "-", // bullet
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "…": "...",
  "→": "->",
  " ": " ", // nbsp
  "\t": "    ",
};

function sanitize(text: string): string {
  let out = "";
  for (const ch of text) {
    if (REPLACEMENTS[ch] !== undefined) {
      out += REPLACEMENTS[ch];
    } else if (ch.codePointAt(0)! > 0xff) {
      out += "?"; // fora do WinAnsi e sem mapeamento conhecido
    } else {
      out += ch;
    }
  }
  return out;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const FONT_SIZE = 11;
const LINE_HEIGHT = 15.5;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Quebra uma linha lógica em várias linhas que cabem na largura útil.
function wrap(line: string, font: PDFFont, size: number): string[] {
  if (line === "") return [""];
  const words = line.split(/(\s+)/); // mantém os espaços como tokens
  const rows: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current + word;
    if (font.widthOfTextAtSize(candidate, size) <= CONTENT_W || current === "") {
      current = candidate;
    } else {
      rows.push(current.trimEnd());
      current = word.trimStart();
    }
  }
  if (current.trimEnd() !== "" || rows.length === 0) rows.push(current.trimEnd());
  return rows;
}

// Renderiza texto puro (com \n) num PDF A4 simples, paginando sozinho.
// A primeira linha não vazia vira o título em negrito.
export async function textToPdf(content: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const clean = sanitize(content.replace(/\r\n/g, "\n"));
  const logicalLines = clean.split("\n");

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let titleUsed = false;

  const drawRow = (text: string, f: PDFFont, size: number) => {
    if (y < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    page.drawText(text, { x: MARGIN, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= size === FONT_SIZE ? LINE_HEIGHT : size * 1.4;
  };

  for (const line of logicalLines) {
    const isTitle = !titleUsed && line.trim() !== "";
    const f = isTitle ? bold : font;
    const size = isTitle ? 15 : FONT_SIZE;
    for (const row of wrap(line, f, size)) drawRow(row, f, size);
    if (isTitle) {
      titleUsed = true;
      y -= 6; // respiro extra depois do título
    }
  }

  return doc.save();
}
