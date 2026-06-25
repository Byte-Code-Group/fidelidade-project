-- Index para lookup rápido por custom_domain (resolvido pelo proxy em cada request).
create index if not exists tenants_custom_domain_idx on public.tenants (custom_domain)
  where custom_domain is not null;
