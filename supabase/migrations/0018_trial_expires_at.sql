alter table public.tenants
  add column if not exists trial_ends_at timestamptz;
