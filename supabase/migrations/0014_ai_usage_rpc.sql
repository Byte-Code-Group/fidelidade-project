-- Atomic increment de tokens usados por tenant/mês.
create or replace function public.increment_ai_usage(
  p_tenant_id  uuid,
  p_year_month text,
  p_tokens     bigint
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.tenant_ai_usage (tenant_id, year_month, tokens_used)
  values (p_tenant_id, p_year_month, p_tokens)
  on conflict (tenant_id, year_month)
  do update set tokens_used = public.tenant_ai_usage.tokens_used + excluded.tokens_used;
end;
$$;
