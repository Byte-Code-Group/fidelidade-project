// O docx-preview (0.3.7) não desenha formas vetoriais do Word (DrawingML wps/wpg):
// logo e ondas de cabeçalho feitos como forma somem do preview. Aqui as formas
// ancoradas do cabeçalho/rodapé viram SVG com posição na página, em pt.
// Funciona com DOMParser do browser e com @xmldom (scripts/test-docx-shapes.mts).

const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const EMU_PER_PT = 12700;
const TWIPS_PER_PT = 20;

export interface PageShape {
  svg: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** wrapTopAndBottom: no Word empurra o texto do cabeçalho pra baixo da forma. */
  pushesText: boolean;
}

export interface PageShapes {
  header: PageShape[];
  footer: PageShape[];
  headerDistance: number;
}

type El = Element | undefined;
const kids = (el: El, name: string) =>
  el ? (Array.from(el.childNodes).filter((n) => n.nodeType === 1 && (n as Element).localName === name) as Element[]) : [];
const kid = (el: El, name: string): El => kids(el, name)[0];
const num = (el: El, attr: string, fallback = 0) => {
  const v = el?.getAttribute(attr);
  return v ? Number(v) : fallback;
};

function pathData(path: Element) {
  const pts = (el: Element) => kids(el, "pt").map((p) => `${num(p, "x")} ${num(p, "y")}`);
  let d = "";
  for (const c of Array.from(path.childNodes) as Element[]) {
    if (c.nodeType !== 1) continue;
    if (c.localName === "moveTo") d += `M${pts(c)[0]}`;
    else if (c.localName === "lnTo") d += `L${pts(c)[0]}`;
    else if (c.localName === "cubicBezTo") d += `C${pts(c).join(" ")}`;
    else if (c.localName === "quadBezTo") d += `Q${pts(c).join(" ")}`;
    else if (c.localName === "close") d += "Z";
    // shortcut: arcTo é ignorado (raro em formas exportadas); implementar se aparecer logo torto.
  }
  return d;
}

function fill(wsp: Element) {
  const spPr = kid(wsp, "spPr");
  if (kid(spPr, "noFill")) return 'fill="none"';
  const clr = kid(kid(spPr, "solidFill") ?? kid(kid(wsp, "style"), "fillRef"), "srgbClr");
  // shortcut: cor de tema (schemeClr) vira cinza; resolver via theme1.xml se aparecer em modelo real.
  const val = clr?.getAttribute("val") ?? "";
  // o SVG vai pro DOM via innerHTML: só aceita hex, nada de aspas vindas do arquivo
  if (!/^[0-9a-f]{6}$/i.test(val)) return 'fill="#999"';
  const alpha = kid(clr, "alpha");
  return `fill="#${val}"${alpha ? ` fill-opacity="${num(alpha, "val") / 100000}"` : ""}`;
}

function xfrm(el: El) {
  const off = kid(el, "off");
  const ext = kid(el, "ext");
  return { x: num(off, "x"), y: num(off, "y"), cx: num(ext, "cx"), cy: num(ext, "cy") };
}

// shortcut: sem rot/flip, contorno (ln) nem formas prontas (prstGeom); só custGeom preenchida.
function shapeSvg(el: Element): string {
  if (el.localName === "wsp") {
    const box = xfrm(kid(kid(el, "spPr"), "xfrm"));
    return kids(kid(kid(kid(el, "spPr"), "custGeom"), "pathLst"), "path")
      .map((p) => {
        const w = num(p, "w", box.cx) || 1;
        const h = num(p, "h", box.cy) || 1;
        return `<path transform="translate(${box.x} ${box.y}) scale(${box.cx / w} ${box.cy / h})" d="${pathData(p)}" ${fill(el)}/>`;
      })
      .join("");
  }
  if (el.localName === "wgp" || el.localName === "grpSp") {
    const x = kid(kid(el, "grpSpPr"), "xfrm");
    const box = xfrm(x);
    const chOff = kid(x, "chOff");
    const chExt = kid(x, "chExt");
    const sx = box.cx / (num(chExt, "cx") || box.cx || 1);
    const sy = box.cy / (num(chExt, "cy") || box.cy || 1);
    const inner = (Array.from(el.childNodes) as Element[]).filter((c) => c.nodeType === 1).map(shapeSvg).join("");
    return `<g transform="translate(${box.x} ${box.y}) scale(${sx} ${sy}) translate(${-num(chOff, "x")} ${-num(chOff, "y")})">${inner}</g>`;
  }
  return "";
}

interface Page {
  w: number;
  h: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  header: number;
  footer: number;
}

// Posição na página (pt) de um eixo do âncora: base da área de referência + align/offset.
function place(pos: El, size: number, area: Record<string, [number, number]>, anchorBase: number) {
  const rel = pos?.getAttribute("relativeFrom") ?? "page";
  const [base, len] = area[rel] ?? [anchorBase, 0];
  const align = kid(pos, "align")?.textContent;
  if (align === "right" || align === "bottom" || align === "outside") return base + len - size;
  if (align === "center") return base + (len - size) / 2;
  if (align) return base;
  return base + Number(kid(pos, "posOffset")?.textContent ?? 0) / EMU_PER_PT;
}

function partShapes(part: Document, page: Page, isHeader: boolean): PageShape[] {
  const { w, h, top, right, bottom, left } = page;
  // shortcut: âncora relativa ao parágrafo/linha usa o topo da área do cabeçalho (ou o rodapé);
  // certo pra forma no 1º parágrafo, aproximado se o cabeçalho tiver várias linhas.
  const paraY = isHeader ? page.header : h - page.footer;
  const hArea: Record<string, [number, number]> = {
    page: [0, w],
    margin: [left, w - left - right],
    column: [left, w - left - right],
    leftMargin: [0, left],
    rightMargin: [w - right, right],
  };
  const vArea: Record<string, [number, number]> = {
    page: [0, h],
    margin: [top, h - top - bottom],
    topMargin: [0, top],
    bottomMargin: [h - bottom, bottom],
  };
  return Array.from(part.getElementsByTagNameNS(WP, "anchor")).flatMap((anchor) => {
    const shape = (Array.from(kid(kid(anchor, "graphic"), "graphicData")?.childNodes ?? []) as Element[]).find(
      (c) => c.nodeType === 1 && (c.localName === "wgp" || c.localName === "wsp"),
    );
    if (!shape) return [];
    const extent = kid(anchor, "extent");
    const cx = num(extent, "cx");
    const cy = num(extent, "cy");
    const width = cx / EMU_PER_PT;
    const height = cy / EMU_PER_PT;
    // wsp solto tem xfrm próprio com off; o âncora já posiciona, então zera.
    const off = shape.localName === "wsp" ? xfrm(kid(kid(shape, "spPr"), "xfrm")) : { x: 0, y: 0 };
    const body = `<g transform="translate(${-off.x} ${-off.y})">${shapeSvg(shape)}</g>`;
    return [
      {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cx} ${cy}" width="100%" height="100%" preserveAspectRatio="none">${body}</svg>`,
        left: place(kid(anchor, "positionH"), width, hArea, left),
        top: place(kid(anchor, "positionV"), height, vArea, paraY),
        width,
        height,
        pushesText: !!kid(anchor, "wrapTopAndBottom"),
      },
    ];
  });
}

/**
 * Lê as formas do cabeçalho/rodapé padrão da última seção do documento.
 * shortcut: usa só o cabeçalho "default" (ignora first/even e seções múltiplas);
 * suficiente pra modelos de uma seção, que é o caso dos termos/contratos.
 */
export async function readPageShapes(
  readPart: (path: string) => Promise<string | undefined>,
  parse: (xml: string) => Document,
): Promise<PageShapes | null> {
  const [docXml, relsXml] = await Promise.all([readPart("word/document.xml"), readPart("word/_rels/document.xml.rels")]);
  if (!docXml || !relsXml) return null;
  const doc = parse(docXml);
  const sects = doc.getElementsByTagNameNS("*", "sectPr");
  const sect = sects[sects.length - 1];
  if (!sect) return null;
  const sz = kid(sect, "pgSz");
  const mar = kid(sect, "pgMar");
  const tw = (el: El, a: string, d: number) => num(el, a, d) / TWIPS_PER_PT;
  const page: Page = {
    w: tw(sz, "w:w", 11906),
    h: tw(sz, "w:h", 16838),
    top: tw(mar, "w:top", 1440),
    right: tw(mar, "w:right", 1440),
    bottom: tw(mar, "w:bottom", 1440),
    left: tw(mar, "w:left", 1440),
    header: tw(mar, "w:header", 720),
    footer: tw(mar, "w:footer", 720),
  };
  const rels = Array.from(parse(relsXml).getElementsByTagNameNS("*", "Relationship"));
  const load = async (refName: string, isHeader: boolean) => {
    const ref = kids(sect, refName).find((r) => r.getAttribute("w:type") === "default");
    const target = rels.find((r) => r.getAttribute("Id") === ref?.getAttributeNS(R, "id"))?.getAttribute("Target");
    const xml = target && (await readPart(`word/${target.replace(/^\/?word\//, "")}`));
    return xml ? partShapes(parse(xml), page, isHeader) : [];
  };
  const [header, footer] = await Promise.all([load("headerReference", true), load("footerReference", false)]);
  return { header, footer, headerDistance: page.header };
}
