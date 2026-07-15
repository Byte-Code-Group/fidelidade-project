import { Fragment } from "react";

// Markdown leve pro texto da IA: negrito (**x**), listas ("- x" / "* x") e
// parágrafos. Sem lib externa — só o suficiente pro que o modelo costuma
// gerar. Também separa bullets que vieram grudados na mesma linha (o
// modelo às vezes escreve "* **A:** ... * **B:** ..." sem quebra real).
export function ChatMarkdown({ text }: { text: string }) {
  const normalized = text.replace(/ (?=\*\s*\*\*[^*]+:\*\*)/g, "\n");
  const blocks = normalized.split(/\n{2,}/);

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

const LIST_ITEM = /^\s*[-*]\s+/;

// Um bloco pode misturar uma linha de intro com uma lista logo abaixo
// (sem linha em branco entre elas) — agrupa por tipo pra sair parágrafo +
// <ul>, em vez de tudo virar um parágrafo só com <br>.
function renderBlock(block: string) {
  const lines = block.split("\n").filter((l) => l.trim() !== "");
  const groups: { list: boolean; lines: string[] }[] = [];

  for (const line of lines) {
    const isListLine = LIST_ITEM.test(line);
    const last = groups[groups.length - 1];
    if (last && last.list === isListLine) {
      last.lines.push(line);
    } else {
      groups.push({ list: isListLine, lines: [line] });
    }
  }

  return (
    <>
      {groups.map((g, i) =>
        g.list ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {g.lines.map((l, j) => (
              <li key={j}>{renderInline(l.replace(LIST_ITEM, ""))}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {g.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(l)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </>
  );
}

function renderInline(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
