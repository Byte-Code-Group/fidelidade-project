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
        label="Conteúdo"
        hint="use {{variáveis}} pra IA preencher, ex: {{nome_cliente}}, {{data}}"
      >
        <textarea
          name="content"
          rows={8}
          defaultValue={template?.content ?? ""}
          placeholder={"Atesto que {{nome_cliente}} compareceu à consulta em {{data}}..."}
          className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--primary)]"
          required
        />
      </Field>
    </>
  );
}
