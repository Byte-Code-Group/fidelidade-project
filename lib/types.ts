// Tipos do domínio (subset do schema — expandir conforme as telas crescem)

import type { SocialKey } from "@/components/social-logos";

export type ThemeMode = "light" | "dark";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  segment_template: string;
  saas_plan: string;
  status: "pending" | "active" | "suspended" | string;
  checkin_token: string;
  owner_email?: string | null;
  owner_cpf_cnpj?: string | null;
  asaas_customer_id?: string | null;
  asaas_subscription_id?: string | null;
  created_at: string;
}

export interface TenantSettings {
  tenant_id: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  theme_mode: ThemeMode;
  ai_name: string;
  ai_welcome_message: string | null;
  ai_tone: string;
  label_client: string;
  label_appointment: string;
  footer_address: string | null;
  footer_phone: string | null;
  footer_whatsapp: string | null;
  footer_website: string | null;
  modules_enabled: Record<string, boolean>;
  loyalty_goal: number;
  loyalty_frequency: string;
  loyalty_points_per_checkin: number;
  loyalty_streak_reset: boolean;
  reward_name: string | null;
  reward_description: string | null;
}

export interface TenantContext {
  tenant: Tenant;
  settings: TenantSettings;
}

export interface Membership {
  id: string;
  tenant_id: string;
  user_id: string;
  plan_id: string | null;
  modality: string;
  status: string;
  member_code: string;
  valid_until: string | null;
  points_total: number;
  pending_plan_id: string | null;
  pending_plan_effective_at: string | null;
  created_at: string;
}

// O ícone é sempre travado pelo tipo — redes sociais usam a logo da marca,
// "custom" usa um ícone genérico. Nunca é escolhido à parte pelo usuário.
export type MissionType = SocialKey | "custom";

export interface Mission {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  icon: string | null;
  type: MissionType;
  external_url: string | null;
  points: number;
  requires_validation: boolean;
  is_active: boolean;
  display_order: number;
}

export type MissionCompletionStatus = "pending_validation" | "completed";

export interface MissionCompletion {
  id: string;
  tenant_id: string;
  user_id: string;
  mission_id: string;
  status: MissionCompletionStatus;
  completed_at: string | null;
  validated_by: string | null;
}

export interface Checkin {
  id: string;
  tenant_id: string;
  user_id: string;
  period_ref: string;
  points_earned: number;
  method: string;
  validated_by: string | null;
  created_at: string;
}

export interface Reward {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  points_cost: number;
  image_url: string | null;
  stock: number | null; // null = ilimitado
  is_active: boolean;
  display_order: number;
}

export interface BusinessPlan {
  id: string;
  tenant_id: string;
  name: string;
  price_month: number;
  benefits: string[];
  is_popular: boolean;
  upgrade_discount_pct: number;
  display_order: number;
}

export interface DocumentTemplate {
  id: string;
  tenant_id: string;
  name: string;
  content: string;
  file_url: string | null;
  file_name: string | null;
  display_order: number;
  created_at: string;
}

export interface RewardRedemption {
  id: string;
  tenant_id: string;
  user_id: string;
  reward_id: string | null;
  reward_name: string;
  points_spent: number;
  status: "pending" | "redeemed";
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
}

export type CarePlanStatus = "active" | "completed" | "paused";

export interface CarePlan {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: CarePlanStatus;
  started_at: string;
  created_by: string | null;
  created_at: string;
}

export interface CarePlanStep {
  id: string;
  care_plan_id: string;
  tenant_id: string;
  title: string;
  notes: string | null;
  done: boolean;
  done_at: string | null;
  display_order: number;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

export interface Appointment {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  scheduled_at: string;
  notes: string | null;
  status: AppointmentStatus;
  created_by: string | null;
  created_at: string;
}

export type DocumentCategory = "documentos" | "termos" | "receituarios";

export interface Document {
  id: string;
  tenant_id: string;
  user_id: string;
  category: DocumentCategory;
  title: string;
  file_url: string;
  created_by: string | null;
  created_at: string;
}

export interface Partnership {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  discount_text: string | null;
  website_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export type ProfileFieldType =
  | "text"
  | "textarea"
  | "date"
  | "select"
  | "cpf"
  | "birthdate"
  | "address"
  | "phone";

export interface ProfileField {
  id: string;
  tenant_id: string;
  label: string;
  field_key: string;
  field_type: ProfileFieldType;
  options: string[] | null;
  required: boolean;
  display_order: number;
  max_length: number | null;
}
