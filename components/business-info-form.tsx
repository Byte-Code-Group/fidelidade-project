import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Select } from "@/components/ui/select";
import { Section, Field } from "@/components/ui/section";
import { SEGMENT_TEMPLATES } from "@/lib/segment-templates";

export function BusinessInfoForm({
  name,
  segment,
  cpfCnpj,
  saveAction,
}: {
  name: string;
  segment: string;
  cpfCnpj: string;
  saveAction: (formData: FormData) => void;
}) {
  return (
    <Section title="Dados do negócio" desc="Nome, segmento e documento do negócio.">
      <form action={saveAction} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome do negócio">
            <Input name="business_name" required defaultValue={name} />
          </Field>
          <Field label="Segmento">
            <Select name="segment" defaultValue={segment}>
              {Object.entries(SEGMENT_TEMPLATES).map(([key, tpl]) => (
                <option key={key} value={key}>
                  {tpl.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="CPF / CNPJ">
          <MaskedInput
            mask="cpf-cnpj"
            name="owner_cpf_cnpj"
            required
            defaultValue={cpfCnpj}
            placeholder="00.000.000/0001-00"
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Section>
  );
}
