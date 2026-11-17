// Self-check do mapeamento de campos no XML do .docx: ./node_modules/.bin/tsx scripts/test-docx-mapping.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { applyMapOp, countBefore, mappedFields, normText, type MapOp } from "../lib/docx-mapping";

const require = createRequire(import.meta.url);
const { DOMParser, XMLSerializer } = require(require.resolve("@xmldom/xmldom", { paths: [require.resolve("mammoth")] }));

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const doc = (body: string) => new DOMParser().parseFromString(`<w:document ${W}><w:body>${body}</w:body></w:document>`, "text/xml");
const xml = (d: Document) => new XMLSerializer().serializeToString(d);
const p = (...runs: string[]) => `<w:p>${runs.map((t) => `<w:r><w:t>${t}</w:t></w:r>`).join("")}</w:p>`;
const op = (o: Partial<MapOp>): MapOp => ({ paraText: "", paraRank: 0, text: "", nth: 0, mode: "replace", field: "nome_cliente", ...o });

// troca atravessando 3 runs: placeholder fica no primeiro, resto some
let d = doc(p("Eu, Ma", "ria da ", "Silva, declaro"));
assert.ok(applyMapOp(d, op({ paraText: normText("Eu, Maria da Silva, declaro"), text: "Maria da Silva" })));
assert.match(xml(d), /<w:t xml:space="preserve">Eu, \{\{ nome_cliente \}\}<\/w:t>.*<w:t xml:space="preserve"\/?>(<\/w:t>)?.*<w:t xml:space="preserve">, declaro<\/w:t>/);
assert.deepEqual(mappedFields(d), ["nome_cliente"]);

// segunda ocorrência + parágrafo repetido (rank)
d = doc(p("Nome: ____") + p("Nome: ____ e ____"));
assert.ok(applyMapOp(d, op({ paraText: normText("Nome: ____ e ____"), text: "____", nth: 1, field: "x" })));
assert.match(xml(d), /Nome: ____ e \{\{ x \}\}/);

// inserção depois do cursor
d = doc(p("Data: ", "fim"));
assert.ok(applyMapOp(d, op({ paraText: "Data:fim", text: "Data: ", mode: "after", field: "data_hoje" })));
assert.match(xml(d), /Data: \{\{ data_hoje \}\}<\/w:t>.*>fim</);

// trecho inexistente não mexe
d = doc(p("abc"));
assert.equal(applyMapOp(d, op({ paraText: "abc", text: "zzz" })), false);

assert.equal(countBefore("a__b__", "__", 5), 2);
assert.equal(countBefore("a__b__", "__", 4), 1);
console.log("docx-mapping ok");
