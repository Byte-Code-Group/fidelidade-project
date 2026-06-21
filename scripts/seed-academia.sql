-- ============================================================
-- Seed — tenant piloto FitZone Academia
-- Segmento: academia — 2º tenant piloto
-- Aplicar via: supabase db query -f scripts/seed-academia.sql --linked
-- ============================================================

insert into public.tenants (id, name, slug, segment_template, saas_plan, status)
values (
  '00000000-0000-0000-0000-000000000002',
  'FitZone Academia',
  'fitzone',
  'academia',
  'starter',
  'active'
) on conflict (id) do nothing;

insert into public.tenant_settings (
  tenant_id, primary_color, secondary_color, theme_mode,
  ai_name, ai_welcome_message, ai_tone,
  label_client, label_appointment,
  footer_address, footer_phone, footer_whatsapp, footer_website,
  modules_enabled,
  loyalty_goal, loyalty_frequency, loyalty_points_per_checkin, loyalty_streak_reset,
  reward_name, reward_description
) values (
  '00000000-0000-0000-0000-000000000002',
  '#f97316', '#ea580c', 'dark',
  'Max', 'E aí! Sou o Max, seu personal virtual da FitZone. Como posso ajudar?', 'divertido',
  'Aluno', 'Aula',
  'Rua das Palmeiras, 200 — Arcos/MG', '(37) 3001-0000', '5537988880000', 'https://fitzone.com.br',
  '{"appointments": true, "partnerships": true}'::jsonb,
  8, 'monthly', 1, false,
  'Mês grátis', 'Complete 8 check-ins em um mês e ganhe o próximo gratuitamente.'
) on conflict (tenant_id) do nothing;

insert into public.business_plans (tenant_id, name, price_month, benefits, is_popular, display_order)
values
  ('00000000-0000-0000-0000-000000000002', 'Básico', 89.90,
   array['Acesso à musculação', 'Vestiários', 'Wi-Fi'], false, 1),
  ('00000000-0000-0000-0000-000000000002', 'Plus', 129.90,
   array['Musculação + aulas coletivas', 'Avaliação física mensal', 'App de treinos'], true, 2),
  ('00000000-0000-0000-0000-000000000002', 'Premium', 199.90,
   array['Tudo do Plus', 'Personal trainer 2x/semana', 'Nutricionista mensal'], false, 3);

insert into public.missions (tenant_id, title, description, icon, type, external_url, points, requires_validation, display_order)
values
  ('00000000-0000-0000-0000-000000000002',
   'Siga a FitZone no Instagram',
   'Siga @fitzone e fique por dentro das novidades e dicas de treino.',
   'instagram', 'social_follow', 'https://instagram.com/fitzone', 15, false, 1),
  ('00000000-0000-0000-0000-000000000002',
   'Curta no Facebook',
   'Curta nossa página e acompanhe as novidades.',
   'facebook', 'social_follow', 'https://facebook.com/fitzone', 15, false, 2),
  ('00000000-0000-0000-0000-000000000002',
   'Faça seu check-in',
   'Marque presença no treino deste mês.',
   'check', 'checkin', null, 10, false, 3);

insert into public.rewards (tenant_id, name, description, points_cost, stock, is_active, display_order)
values
  ('00000000-0000-0000-0000-000000000002',
   'Camiseta FitZone', 'Camiseta exclusiva da academia.', 200, 10, true, 1),
  ('00000000-0000-0000-0000-000000000002',
   'Avaliação física grátis', 'Avaliação física completa com personal trainer.', 100, null, true, 2),
  ('00000000-0000-0000-0000-000000000002',
   '1 mês de suplemento', 'Whey protein 900g da marca parceira.', 500, 5, true, 3);
