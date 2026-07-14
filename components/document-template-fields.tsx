import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import type { DocumentTemplate } from "@/lib/types";

export function DocumentTemplateFields({ template }: { template?: DocumentTemplate }) {
  return (
    <>
      <Field label="Nome" hint="ex: Atestado, Contrato, Termo de consentimento">
        <Input name="name" defaultValue={template?.name ?? ""} required />
      </Field>

      <Field
        label="Arquivo (PDF ou DOCX)"
        hint="a IA lê o texto do arquivo pra entender o formato do documento"
      >
        <input
          type="file"
          name="file"
          accept=".pdf,.docx"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm file:font-medium dark:file:bg-white/10"
        />
        {template?.file_name && (
          <p className="text-xs opacity-60">
            Atual:{" "}
            {template.file_url ? (
              <a href={template.file_url} target="_blank" rel="noreferrer" className="underline">
                {template.file_name}
              </a>
            ) : (
              template.file_name
            )}{" "}
            — anexe outro pra substituir.
          </p>
        )}
      </Field>

      <Field
        label="Conteúdo"
        hint="extraído do arquivo, ou cole/edite o texto manualmente — use {{variáveis}}"
      >
        <textarea
          name="content"
          rows={8}
          defaultValue={template?.content ?? ""}
          placeholder={"Atesto que {{nome_cliente}} compareceu à consulta em {{data}}..."}
          className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--primary)]"
        />
      </Field>
    </>
  );
}
