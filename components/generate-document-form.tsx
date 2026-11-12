"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { traduzirErro } from "@/lib/error-messages";

interface GenerateDocumentFormProps {
  templates: { id: string; name: string }[];
  action: (formData: FormData) => Promise<{ error?: string; emptyFields?: string[] }>;
}

// Dono escolhe um modelo e a IA gera o documento com os dados do cliente.
export function GenerateDocumentForm({ templates, action }: GenerateDocumentFormProps) {
  if (!templates.length) {
    return (
      <p className="px-6 py-4 text-sm opacity-60">
        Cadastre um modelo em{" "}
        <Link href="/painel/documentos" className="underline">
          Documentos
        </Link>{" "}
        pra gerar documentos com IA.
      </p>
    );
  }

  return (
    <form
      className="space-y-3 border-b border-black/10 px-6 py-4 dark:border-white/10"
      action={async (formData) => {
        const { error, emptyFields } = await action(formData);
        if (error) return void toast.error(traduzirErro(error));
        toast.success("Documento gerado e salvo nos documentos do cliente.", {
          description: emptyFields?.length ? `Sem dado para: ${emptyFields.join(", ")}` : undefined,
        });
      }}
    >
      <p className="text-sm font-medium">Gerar documento com IA</p>
      <Select name="templateId" required aria-label="Modelo">
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      <Textarea
        name="instructions"
        rows={2}
        maxLength={2000}
        placeholder="Instruções opcionais (ex.: atestado de 2 dias a partir de hoje)"
        aria-label="Instruções"
      />
      <Button type="submit" pendingLabel="Gerando…">
        Gerar documento
      </Button>
    </form>
  );
}
