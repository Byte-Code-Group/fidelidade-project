import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Partnership } from "@/lib/types";
import {
  createPartnership,
  updatePartnership,
  deletePartnership,
} from "../../../../actions";

export default async function PartnershipsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: partnerships } = await db
    .from("partnerships")
    .select("*")
    .eq("tenant_id", id)
    .order("display_order", { ascending: true })
    .returns<Partnership[]>();

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        Convênios e vantagens para membros do programa. Exibidos na aba
        Parcerias do portal (módulo deve estar ativo em Customização).
      </p>

      {(partnerships ?? []).map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-3">
            <form
              action={updatePartnership.bind(null, id, p.id)}
              className="space-y-3"
            >
              <PartnershipForm partnership={p} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form action={deletePartnership.bind(null, id, p.id)}>
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Excluir parceria
              </button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent>
          <h2 className="mb-3 font-semibold">Nova parceria</h2>
          <form
            action={createPartnership.bind(null, id)}
            className="space-y-3"
          >
            <PartnershipForm />
            <div className="flex justify-end">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PartnershipForm({ partnership }: { partnership?: Partnership }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper label="Nome do parceiro">
          <Input name="name" defaultValue={partnership?.name ?? ""} required />
        </FieldWrapper>
        <FieldWrapper label="Desconto / benefício" hint="ex: 10% de desconto">
          <Input
            name="discount_text"
            defaultValue={partnership?.discount_text ?? ""}
            placeholder="10% de desconto"
          />
        </FieldWrapper>
      </div>

      <FieldWrapper label="Descrição">
        <Input
          name="description"
          defaultValue={partnership?.description ?? ""}
        />
      </FieldWrapper>

      <div className="grid grid-cols-2 gap-3">
        <FieldWrapper label="URL do logo">
          <Input
            name="logo_url"
            type="url"
            defaultValue={partnership?.logo_url ?? ""}
            placeholder="https://..."
          />
        </FieldWrapper>
        <FieldWrapper label="Site do parceiro">
          <Input
            name="website_url"
            type="url"
            defaultValue={partnership?.website_url ?? ""}
            placeholder="https://..."
          />
        </FieldWrapper>
      </div>

      <div className="flex items-center gap-6">
        <FieldWrapper label="Ordem">
          <Input
            name="display_order"
            type="number"
            defaultValue={partnership?.display_order ?? 0}
            className="w-24"
          />
        </FieldWrapper>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={partnership?.is_active ?? true}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Ativo
          </label>
        </div>
      </div>
    </>
  );
}

function FieldWrapper({
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
