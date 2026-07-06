import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Select } from "@/components/ui/select";
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
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-semibold">Dados do negócio</h2>
        <form action={saveAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome do negócio</label>
            <Input name="business_name" required defaultValue={name} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Segmento</label>
            <Select name="segment" defaultValue={segment}>
              {Object.entries(SEGMENT_TEMPLATES).map(([key, tpl]) => (
                <option key={key} value={key}>
                  {tpl.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">CPF / CNPJ</label>
            <MaskedInput
              mask="cpf-cnpj"
              name="owner_cpf_cnpj"
              required
              defaultValue={cpfCnpj}
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" className="px-4 py-2 text-sm">
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
