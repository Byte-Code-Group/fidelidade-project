-- ============================================================
-- Seed — tenant piloto OralDents (Arcos/MG)
-- Roda automaticamente no `supabase db reset`.
-- O usuário demo + membership são criados por scripts/seed-auth.ts
-- (precisam de auth.users, criado via admin API).
-- ============================================================

-- Tenant (UUID fixo p/ o seed-auth referenciar)
insert into public.tenants (id, name, slug, segment_template, saas_plan, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'OralDents',
  'oraldents',
  'odonto',
  'pro',
  'active'
);

-- Settings / branding
insert into public.tenant_settings (
  tenant_id, primary_color, secondary_color, theme_mode,
  ai_name, ai_welcome_message, ai_tone,
  label_client, label_appointment,
  footer_address, footer_phone, footer_whatsapp, footer_website,
  modules_enabled,
  loyalty_goal, loyalty_frequency, loyalty_points_per_checkin, loyalty_streak_reset,
  reward_name, reward_description
) values (
  '00000000-0000-0000-0000-000000000001',
  '#0ea5a4', '#0f766e', 'light',
  'Sofia', 'Oi! Eu sou a Sofia, assistente da OralDents. Como posso ajudar?', 'amigavel',
  'Paciente', 'Consulta',
  'Av. Central, 100 — Arcos/MG', '(37) 3000-0000', '5537999990000', 'https://oraldents.com.br',
  '{"appointments": true, "documents": true, "care_plans": true, "partnerships": true}'::jsonb,
  6, 'monthly', 1, false,
  'Limpeza profissional grátis', 'Complete 6 check-ins e ganhe uma limpeza profissional.'
);

-- Planos do negócio (vitrine)
insert into public.business_plans (tenant_id, name, price_month, benefits, is_popular, display_order)
values
  ('00000000-0000-0000-0000-000000000001', 'Essencial', 49.90,
   array['1 limpeza/ano', 'Avaliação clínica', 'Desconto 10% em procedimentos'], false, 1),
  ('00000000-0000-0000-0000-000000000001', 'Cuidado', 89.90,
   array['2 limpezas/ano', 'Raio-X panorâmico', 'Desconto 20%', 'Clareamento com desconto'], true, 2),
  ('00000000-0000-0000-0000-000000000001', 'Família', 149.90,
   array['Até 4 dependentes', '2 limpezas/ano por membro', 'Desconto 25%'], false, 3);

-- Missões de engajamento — redes sociais (logos no portal)
insert into public.missions (tenant_id, title, description, icon, type, external_url, points, requires_validation, display_order)
values
  ('00000000-0000-0000-0000-000000000001', 'Siga no Instagram',
   'Siga @oraldents e fique por dentro das novidades.', 'instagram', 'social_follow',
   'https://instagram.com/oraldents', 20, false, 1),
  ('00000000-0000-0000-0000-000000000001', 'Curta no Facebook',
   'Curta nossa página e acompanhe as novidades.', 'facebook', 'social_follow',
   'https://facebook.com/oraldents', 20, false, 2),
  ('00000000-0000-0000-0000-000000000001', 'Inscreva-se no YouTube',
   'Dicas de saúde bucal no nosso canal.', 'youtube', 'social_follow',
   'https://youtube.com/@oraldents', 25, false, 3),
  ('00000000-0000-0000-0000-000000000001', 'Siga no X',
   'Acompanhe a OralDents no X.', 'x', 'social_follow',
   'https://x.com/oraldents', 15, false, 4),
  ('00000000-0000-0000-0000-000000000001', 'Faça seu check-in',
   'Marque presença na sua consulta deste mês.', 'check', 'checkin',
   null, 10, false, 5);

-- Loja de Resgate — prêmios da OralDents
insert into public.rewards (tenant_id, name, description, points_cost, stock, is_active, display_order)
values
  ('00000000-0000-0000-0000-000000000001', 'Limpeza profissional grátis',
   'Uma limpeza completa por nossa conta.', 120, null, true, 1),
  ('00000000-0000-0000-0000-000000000001', 'Clareamento com 50% OFF',
   'Desconto de 50% no clareamento dental.', 200, 20, true, 2),
  ('00000000-0000-0000-0000-000000000001', 'Kit de higiene bucal',
   'Escova, creme dental e fio dental.', 60, 50, true, 3);

-- Campos de cadastro do paciente (Perfil) — clínica odontológica
insert into public.profile_fields (tenant_id, label, field_key, field_type, options, required, display_order)
values
  ('00000000-0000-0000-0000-000000000001', 'CPF', 'cpf', 'text', null, true, 1),
  ('00000000-0000-0000-0000-000000000001', 'RG', 'rg', 'text', null, false, 2),
  ('00000000-0000-0000-0000-000000000001', 'Data de nascimento', 'data_nascimento', 'date', null, false, 3),
  ('00000000-0000-0000-0000-000000000001', 'Telefone principal', 'telefone_principal', 'text', null, true, 4),
  ('00000000-0000-0000-0000-000000000001', 'Telefone de urgência', 'telefone_urgencia', 'text', null, false, 5),
  ('00000000-0000-0000-0000-000000000001', 'Instagram', 'instagram', 'text', null, false, 6),
  ('00000000-0000-0000-0000-000000000001', 'TikTok', 'tiktok', 'text', null, false, 7),
  ('00000000-0000-0000-0000-000000000001', 'CEP', 'cep', 'text', null, false, 8),
  ('00000000-0000-0000-0000-000000000001', 'Tipo de convênio', 'tipo_convenio', 'select',
   '["Particular","Unimed","Bradesco Saúde","Amil","SulAmérica","Outro"]'::jsonb, false, 9),
  ('00000000-0000-0000-0000-000000000001', 'Endereço', 'endereco', 'text', null, false, 10),
  ('00000000-0000-0000-0000-000000000001', 'Observações médicas', 'observacoes_medicas', 'textarea', null, false, 11);
