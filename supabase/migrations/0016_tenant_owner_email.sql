alter table public.tenants
  add column if not exists owner_email text;
