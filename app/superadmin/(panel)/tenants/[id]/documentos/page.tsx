import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, signedUrl } from "@/lib/storage";
import type { Document } from "@/lib/types";
import { createDocument, deleteDocument } from "../../../../actions";

interface DocumentRow extends Document {
  users: { full_name: string | null; email: string | null } | null;
}

interface ClientOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

const CATEGORIES = [
  ["documentos", "Documentos"],
  ["termos", "Termos"],
  ["receituarios", "Receituários"],
] as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function DocumentosAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const [{ data: documents }, { data: clients }] = await Promise.all([
    db
      .from("documents")
      .select("*, users!documents_user_id_fkey(full_name, email)")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .returns<DocumentRow[]>(),
    db
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", id)
      .eq("role", "client")
      .order("full_name", { ascending: true })
      .returns<ClientOption[]>(),
  ]);

  // Bucket privado: o file_url guardado é um path, precisa de signed URL.
  const documentRows = await Promise.all(
    (documents ?? []).map(async (doc) => ({
      ...doc,
      file_url: await signedUrl(BUCKETS.documents, doc.file_url),
    })),
  );

  return (
    <div className="space-y-6">
      <p className="text-sm opacity-60">
        Arquivos enviados pelo operador que ficam visíveis para o cliente no
        portal (aba Documentos).
      </p>

      {/* Novo documento */}
      <Card>
        <CardContent>
          <h2 className="mb-4 font-semibold">Enviar documento</h2>
          {!clients || clients.length === 0 ? (
            <p className="text-sm opacity-50">
              Nenhum cliente cadastrado ainda.
            </p>
          ) : (
            <form
              action={createDocument.bind(null, id)}
              encType="multipart/form-data"
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Cliente</span>
                  <Select name="user_id" required>
                    <option value="">Selecione...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name ?? c.email ?? c.id}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Categoria</span>
                  <Select name="category" defaultValue="documentos">
                    {CATEGORIES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Título</span>
                <Input name="title" required placeholder="Receituário 18/06" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Arquivo</span>
                <input
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  className="block w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary)]/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-[var(--primary)] dark:border-white/10"
                />
                <p className="text-xs opacity-50">PDF, imagem ou Word · máx. 10 MB</p>
              </label>
              <div className="flex justify-end">
                <Button type="submit">Enviar</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Lista */}
      {documentRows.length > 0 && (
        <Card>
          <div className="divide-y divide-black/5">
            {documentRows.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs opacity-60">
                    {doc.users?.full_name ?? doc.users?.email ?? "—"} ·{" "}
                    {fmtDate(doc.created_at)}
                  </p>
                </div>
                <Badge className="bg-black/5">
                  {CATEGORIES.find(([v]) => v === doc.category)?.[1] ??
                    doc.category}
                </Badge>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--primary)] hover:underline"
                >
                  Ver
                </a>
                <form action={deleteDocument.bind(null, id, doc.id)}>
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Excluir
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
