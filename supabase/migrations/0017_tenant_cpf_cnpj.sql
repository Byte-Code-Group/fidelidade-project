alter table public.tenants
  add column if not exists owner_cpf_cnpj text;
