import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileFieldForm } from "@/components/profile-field-form";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileField } from "@/lib/types";
import {
  createProfileField,
  updateProfileField,
  deleteProfileField,
} from "../../../../actions";

export default async function ProfileFieldsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: fields } = await db
    .from("profile_fields")
    .select("*")
    .eq("tenant_id", id)
    .order("display_order", { ascending: true })
    .returns<ProfileField[]>();

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        Campos extras que aparecem no formulário de perfil do cliente. Os campos
        padrão (nome e e-mail) são sempre exibidos.
      </p>

      {(fields ?? []).map((f) => (
        <Card key={f.id}>
          <CardContent className="space-y-3">
            <form
              action={async (formData: FormData) => {
                "use server";
                await updateProfileField(id, f.id, formData);
              }}
              className="space-y-3"
            >
              <ProfileFieldForm field={f} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form
              action={async () => {
                "use server";
                await deleteProfileField(id, f.id);
              }}
            >
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Excluir campo
              </button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent>
          <h2 className="mb-3 font-semibold">Novo campo</h2>
          <form
            action={async (formData: FormData) => {
              "use server";
              await createProfileField(id, formData);
            }}
            className="space-y-3"
          >
            <ProfileFieldForm />
            <div className="flex justify-end">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
