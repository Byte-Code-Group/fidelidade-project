/**
 * Campos que o dono pode mapear num modelo .docx. Cada um vira {{ chave }}
 * no arquivo; na geração, clientDataText (lib/agent-hub.ts) manda a mesma
 * chave com o valor, então a IA casa campo e dado sem adivinhar.
 *
 * Sem "server-only": o editor de mapeamento (client) lista estes campos.
 */
export interface DocField {
  key: string;
  label: string;
  example: string;
}

export interface DocFieldGroup {
  id: "geral" | "empresa" | "cliente";
  title: string;
  fields: DocField[];
}

export function fieldSlug(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Chave de um campo de cadastro do negócio (profile_fields). */
export const profileFieldKey = (label: string) => `cliente_${fieldSlug(label)}`;

export function documentFieldGroups(profileFieldLabels: string[]): DocFieldGroup[] {
  return [
    {
      id: "geral",
      title: "Informações gerais",
      fields: [
        { key: "data_hoje", label: "Data de hoje", example: "17/11/2026" },
        { key: "data_extenso", label: "Data por extenso", example: "17 de novembro de 2026" },
      ],
    },
    {
      id: "empresa",
      title: "Informações da empresa",
      fields: [
        { key: "nome_empresa", label: "Nome da empresa", example: "Clínica Sorriso" },
        { key: "documento_empresa", label: "CPF / CNPJ", example: "00.000.000/0001-00" },
        { key: "email_empresa", label: "E-mail", example: "contato@empresa.com" },
        { key: "telefone_empresa", label: "Telefone", example: "(11) 3333-4444" },
        { key: "whatsapp_empresa", label: "WhatsApp", example: "(11) 99999-0000" },
        { key: "endereco_empresa", label: "Endereço", example: "Rua das Flores, 120" },
        { key: "site_empresa", label: "Site", example: "empresa.com.br" },
      ],
    },
    {
      id: "cliente",
      title: "Informações do cliente",
      fields: [
        { key: "nome_cliente", label: "Nome completo", example: "Maria da Silva" },
        { key: "email_cliente", label: "E-mail", example: "maria@email.com" },
        { key: "cliente_desde", label: "Cliente desde", example: "03/02/2025" },
        { key: "plano_cliente", label: "Plano", example: "Mensal" },
        { key: "codigo_carteirinha", label: "Código da carteirinha", example: "A1B2C3" },
        { key: "pontos_cliente", label: "Pontos", example: "120" },
        { key: "validade_carteirinha", label: "Carteirinha válida até", example: "31/12/2026" },
        ...profileFieldLabels.map((label) => ({ key: profileFieldKey(label), label, example: "" })),
      ],
    },
  ];
}
