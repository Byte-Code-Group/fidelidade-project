// Templates de segmento — FIXOS (definidos em código, não editáveis em runtime).
// Cada template é o "teto" de uma empresa: define os módulos/páginas disponíveis,
// os rótulos e os defaults de marca/conteúdo. Ao criar uma empresa ela herda o
// template; depois é possível REMOVER módulos e personalizar marca/textos/logo,
// mas NUNCA adicionar um módulo que o template não tem.

import type { ProfileFieldType, ThemeMode } from "@/lib/types";

// Módulos verticais disponíveis na plataforma (páginas opcionais do portal).
export const MODULES = [
  { key: "appointments", label: "Agendamentos" },
  { key: "documents", label: "Documentos" },
  { key: "care_plans", label: "Acompanhamentos" },
  { key: "partnerships", label: "Parcerias / Convênios" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export interface SegmentDefaults {
  primary_color: string;
  secondary_color: string;
  theme_mode: ThemeMode;
  ai_name: string;
  ai_welcome_message: string;
  reward_name: string;
  reward_description: string;
  loyalty_goal: number;
  loyalty_frequency: "monthly" | "weekly" | "per_visit";
}

export interface ProfileFieldDef {
  label: string;
  field_key: string;
  field_type: ProfileFieldType;
  options?: string[]; // para field_type 'select'
  required?: boolean;
  max_length?: number;
}

export interface SegmentTemplate {
  label: string; // nome do segmento
  emoji: string;
  label_client: string; // como o portal chama o cliente
  label_appointment: string; // como chama o agendamento
  modules: ModuleKey[]; // TETO: módulos disponíveis neste template
  defaults: SegmentDefaults;
  profileFields?: ProfileFieldDef[]; // campos do cadastro do cliente (Perfil)
}

// Campos de cadastro padrão de uma clínica odontológica (herdados pelo Perfil).
const ODONTO_PROFILE_FIELDS: ProfileFieldDef[] = [
  { label: "CPF", field_key: "cpf", field_type: "cpf", required: true },
  { label: "RG", field_key: "rg", field_type: "text" },
  { label: "Data de nascimento", field_key: "data_nascimento", field_type: "birthdate" },
  { label: "Telefone principal", field_key: "telefone_principal", field_type: "text", required: true },
  { label: "Telefone de urgência", field_key: "telefone_urgencia", field_type: "text" },
  { label: "Instagram", field_key: "instagram", field_type: "text" },
  { label: "TikTok", field_key: "tiktok", field_type: "text" },
  { label: "CEP", field_key: "cep", field_type: "text" },
  {
    label: "Tipo de convênio",
    field_key: "tipo_convenio",
    field_type: "select",
    options: ["Particular", "Unimed", "Bradesco Saúde", "Amil", "SulAmérica", "Outro"],
  },
  { label: "Endereço", field_key: "endereco", field_type: "address" },
  { label: "Observações médicas", field_key: "observacoes_medicas", field_type: "textarea" },
];

export const SEGMENT_TEMPLATES: Record<string, SegmentTemplate> = {
  odonto: {
    label: "Odontologia",
    emoji: "🦷",
    label_client: "Paciente",
    label_appointment: "Consulta",
    modules: ["appointments", "documents", "care_plans", "partnerships"],
    // Base canônica = OralDents (ver supabase/seed.sql). Toda clínica de odonto
    // herda isto e depois personaliza.
    defaults: {
      primary_color: "#0ea5a4",
      secondary_color: "#0f766e",
      theme_mode: "light",
      ai_name: "Sofia",
      ai_welcome_message:
        "Oi! Eu sou a Sofia, assistente da clínica. Como posso ajudar?",
      reward_name: "Limpeza profissional grátis",
      reward_description:
        "Complete 6 check-ins e ganhe uma limpeza profissional.",
      loyalty_goal: 6,
      loyalty_frequency: "monthly",
    },
    profileFields: ODONTO_PROFILE_FIELDS,
  },
  academia: {
    label: "Academia",
    emoji: "🏋️",
    label_client: "Aluno",
    label_appointment: "Aula",
    modules: ["appointments", "care_plans"],
    defaults: {
      primary_color: "#16a34a",
      secondary_color: "#15803d",
      theme_mode: "dark",
      ai_name: "Alex",
      ai_welcome_message:
        "E aí! Sou o Alex, seu assistente de treino. Bora evoluir?",
      reward_name: "1 mês grátis",
      reward_description: "Mantenha a frequência e ganhe um mês por nossa conta.",
      loyalty_goal: 8,
      loyalty_frequency: "weekly",
    },
  },
  barbearia: {
    label: "Barbearia",
    emoji: "💈",
    label_client: "Cliente",
    label_appointment: "Horário",
    modules: ["appointments"],
    defaults: {
      primary_color: "#f59e0b",
      secondary_color: "#b45309",
      theme_mode: "dark",
      ai_name: "Léo",
      ai_welcome_message: "Fala! Sou o Léo. Quer marcar um corte?",
      reward_name: "Corte grátis",
      reward_description: "A cada 10 cortes, o próximo é por nossa conta.",
      loyalty_goal: 10,
      loyalty_frequency: "monthly",
    },
  },
  salao: {
    label: "Salão de Beleza",
    emoji: "💇",
    label_client: "Cliente",
    label_appointment: "Horário",
    modules: ["appointments", "care_plans"],
    defaults: {
      primary_color: "#db2777",
      secondary_color: "#be185d",
      theme_mode: "dark",
      ai_name: "Bella",
      ai_welcome_message: "Oi, linda! Sou a Bella. Vamos agendar seu horário?",
      reward_name: "Escova grátis",
      reward_description: "Acumule pontos e ganhe uma escova.",
      loyalty_goal: 8,
      loyalty_frequency: "monthly",
    },
  },
  restaurante: {
    label: "Restaurante",
    emoji: "🍽️",
    label_client: "Cliente",
    label_appointment: "Reserva",
    modules: ["appointments", "partnerships"],
    defaults: {
      primary_color: "#dc2626",
      secondary_color: "#991b1b",
      theme_mode: "dark",
      ai_name: "Gino",
      ai_welcome_message: "Buongiorno! Sou o Gino. Quer reservar uma mesa?",
      reward_name: "Sobremesa grátis",
      reward_description: "A cada 10 visitas, a sobremesa é por nossa conta.",
      loyalty_goal: 10,
      loyalty_frequency: "per_visit",
    },
  },
  estetica: {
    label: "Clínica Estética",
    emoji: "✨",
    label_client: "Cliente",
    label_appointment: "Sessão",
    modules: ["appointments", "documents", "care_plans", "partnerships"],
    defaults: {
      primary_color: "#7c3aed",
      secondary_color: "#6d28d9",
      theme_mode: "dark",
      ai_name: "Lúmi",
      ai_welcome_message: "Olá! Sou a Lúmi. Como posso cuidar de você hoje?",
      reward_name: "Sessão grátis",
      reward_description: "Complete seu pacote e ganhe uma sessão extra.",
      loyalty_goal: 6,
      loyalty_frequency: "monthly",
    },
  },
  generico: {
    label: "Genérico",
    emoji: "🏷️",
    label_client: "Cliente",
    label_appointment: "Agendamento",
    modules: [],
    defaults: {
      primary_color: "#2563eb",
      secondary_color: "#1e40af",
      theme_mode: "light",
      ai_name: "Assistente",
      ai_welcome_message: "Olá! Como posso ajudar?",
      reward_name: "Recompensa",
      reward_description: "Acumule pontos e troque por recompensas.",
      loyalty_goal: 6,
      loyalty_frequency: "monthly",
    },
  },
};

// Template por chave, com fallback para o genérico.
export function getTemplate(segment: string): SegmentTemplate {
  return SEGMENT_TEMPLATES[segment] ?? SEGMENT_TEMPLATES.generico;
}

// Mapa { modulo: true } com TODOS os módulos do template (estado inicial da empresa).
export function modulesEnabledFromTemplate(
  segment: string,
): Record<string, boolean> {
  return Object.fromEntries(getTemplate(segment).modules.map((m) => [m, true]));
}

// Garante que um conjunto de módulos respeite o teto do template: mantém só os
// módulos que o template permite (remover é ok, adicionar além do template não).
export function clampModulesToTemplate(
  segment: string,
  desired: Record<string, boolean>,
): Record<string, boolean> {
  const allowed = getTemplate(segment).modules;
  return Object.fromEntries(allowed.map((m) => [m, desired[m] === true]));
}
