import { PageHeader } from "@/components/ui/page-header";
import { OwnerAssistant } from "@/components/owner-assistant";

export default function AssistentePage() {
  return (
    <div>
      <PageHeader
        icon="sparkles"
        title="Assistente IA"
        subtitle="Peça documentos para seus clientes em linguagem natural."
      />
      <OwnerAssistant />
    </div>
  );
}
