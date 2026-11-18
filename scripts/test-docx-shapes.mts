// Self-check das formas do cabeçalho: ./node_modules/.bin/tsx scripts/test-docx-shapes.mts [arquivo.docx]
// Sem arquivo, testa um cabeçalho mínimo; com arquivo, imprime o que achou e grava /tmp/docx-shapes.svg.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { readPageShapes } from "../lib/docx-shapes";

const require = createRequire(import.meta.url);
const { DOMParser } = require(require.resolve("@xmldom/xmldom", { paths: [require.resolve("mammoth")] }));
const parse = (xml: string) => new DOMParser().parseFromString(xml, "text/xml");

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"';
const parts: Record<string, string> = {
  "word/document.xml": `<w:document ${NS}><w:body><w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:pgSz w:w="12000" w:h="16000"/><w:pgMar w:top="1440" w:right="1000" w:bottom="1440" w:left="2000" w:header="720" w:footer="720"/></w:sectPr></w:body></w:document>`,
  "word/_rels/document.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="header1.xml"/></Relationships>`,
  "word/header1.xml": `<w:hdr ${NS}><w:p><w:r><w:drawing><wp:anchor><wp:positionH relativeFrom="margin"><wp:align>right</wp:align></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>127000</wp:posOffset></wp:positionV><wp:extent cx="254000" cy="127000"/><wp:wrapTopAndBottom/><a:graphic><a:graphicData><wps:wsp><wps:spPr><a:xfrm><a:off x="5" y="5"/><a:ext cx="254000" cy="127000"/></a:xfrm><a:custGeom><a:pathLst><a:path w="2" h="1"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="2" y="1"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom><a:solidFill><a:srgbClr val="FF0000"><a:alpha val="50000"/></a:srgbClr></a:solidFill></wps:spPr></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p></w:hdr>`,
};

const file = process.argv[2];
if (!file) {
  const s = await readPageShapes(async (p) => parts[p], parse);
  assert.ok(s);
  assert.equal(s.header.length, 1);
  const [h] = s.header;
  // página 600pt, margem direita 50pt, forma 20pt → left = 600 - 50 - 20
  assert.deepEqual([h.left, h.top, h.width, h.height, h.pushesText], [530, 10, 20, 10, true]);
  assert.match(h.svg, /d="M0 0L2 1Z" fill="#FF0000" fill-opacity="0.5"/);
  assert.match(h.svg, /translate\(-5 -5\)/);
  assert.equal(s.headerDistance, 36);
  console.log("ok");
} else {
  const zip = await JSZip.loadAsync(await readFile(file));
  const s = await readPageShapes(async (p) => zip.file(p)?.async("string"), parse);
  assert.ok(s);
  for (const sh of [...s.header, ...s.footer]) console.log({ ...sh, svg: `${sh.svg.length} chars` });
  const nested = s.header
    .map((sh) => sh.svg.replace(' width="100%" height="100%"', ` x="${sh.left}" y="${sh.top}" width="${sh.width}" height="${sh.height}"`))
    .join("");
  await writeFile("/tmp/docx-shapes.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 200" width="1190" height="400"><rect width="595" height="200" fill="white"/>${nested}</svg>`);
  console.log("gravado /tmp/docx-shapes.svg");
}
