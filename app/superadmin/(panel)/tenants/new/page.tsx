import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SEGMENT_TEMPLATES } from "@/lib/segment-templates";
import { createTenant } from "../../../actions";

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link href="/superadmin" className="text-sm opacity-60 hover:opacity-100">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Novo cliente</h1>
        <p className="text-sm opacity-60">
          O segmento define labels e módulos iniciais — tudo editável depois.
        </p>
      </div>

      <Card>
        <CardContent>
          <form action={createTenant} className="space-y-4">
            <Field label="Nome do negócio" hint="o subdomínio é gerado automaticamente">
              <Input name="name" required placeholder="Ex.: OralDents" />
            </Field>

            <Field label="Segmento">
              <Select name="segment_template" defaultValue="generico">
                {Object.entries(SEGMENT_TEMPLATES).map(([key, tpl]) => (
                  <option key={key} value={key}>
                    {tpl.label}
                  </option>
                ))}
              </Select>
            </Field>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full">
              Criar cliente
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal opacity-50">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
