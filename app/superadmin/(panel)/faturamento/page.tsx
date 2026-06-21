import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/icons";

export default function FaturamentoPage() {
  return (
    <div>
      <PageHeader
        title="Faturamento"
        subtitle="Receita recorrente e faturas por empresa."
      />
      <EmptyState
        icon={<Icon name="receipt" className="h-6 w-6" />}
        title="Faturamento em breve"
        description="O billing recorrente (Pix + assinatura) entra na Fase 3. Por enquanto, gerencie planos e status das empresas em Empresas."
      />
    </div>
  );
}
