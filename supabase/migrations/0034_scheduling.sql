-- ============================================================
-- 0034 — Agenda: profissionais, procedimentos, horários e folgas
--
-- appointments (0008) guardava só título + data. Agora o agendamento passa a
-- ser estruturado: cada um aponta para um profissional (doutor) e um
-- procedimento, e a duração vem do procedimento. Os campos antigos seguem
-- válidos (title continua sendo o rótulo exibido), então os agendamentos já
-- existentes continuam funcionando com provider/procedure nulos.
--
-- Horário de atendimento = provider_schedules (recorrente por dia da semana)
-- menos schedule_exceptions (folga/bloqueio numa data). Os horários são
-- guardados como `time` no fuso do negócio (tenant_settings.timezone).
-- ============================================================

-- ------------------------------------------------------------
-- Fuso do negócio: usado para transformar "09:00 de terça" em instante real.
-- ------------------------------------------------------------
alter table public.tenant_settings
  add column if not exists timezone text not null default 'America/Sao_Paulo';

-- ------------------------------------------------------------
-- Profissionais (doutores, dentistas, cabeleireiros… conforme o segmento)
-- ------------------------------------------------------------
create table public.providers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  specialty     text,
  color         text not null default '#2563EB', -- cor no calendário
  is_active     boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create index providers_tenant_id_idx on public.providers(tenant_id);

-- ------------------------------------------------------------
-- Procedimentos (consulta, limpeza, corte…). A duração define o slot.
-- ------------------------------------------------------------
create table public.procedures (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  description   text,
  duration_min  integer not null default 30 check (duration_min between 5 and 600),
  price_cents   integer check (price_cents >= 0),
  is_active     boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create index procedures_tenant_id_idx on public.procedures(tenant_id);

-- ------------------------------------------------------------
-- Quais procedimentos cada profissional atende.
-- Sem nenhuma linha para um profissional = atende todos (evita obrigar
-- configuração extra em negócio pequeno, de um único doutor).
-- ------------------------------------------------------------
create table public.provider_procedures (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  provider_id  uuid not null references public.providers(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  primary key (provider_id, procedure_id)
);

create index provider_procedures_tenant_id_idx on public.provider_procedures(tenant_id);
create index provider_procedures_procedure_id_idx on public.provider_procedures(procedure_id);

-- ------------------------------------------------------------
-- Horário de trabalho recorrente. Vários blocos por dia são permitidos
-- (ex.: 08:00–12:00 e 13:00–18:00, com o almoço fora).
-- weekday: 0 = domingo … 6 = sábado (igual a Date.getDay()).
-- ------------------------------------------------------------
create table public.provider_schedules (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  provider_id  uuid not null references public.providers(id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  created_at   timestamptz not null default now(),
  check (end_time > start_time)
);

create index provider_schedules_provider_idx on public.provider_schedules(provider_id, weekday);
create index provider_schedules_tenant_id_idx on public.provider_schedules(tenant_id);

-- ------------------------------------------------------------
-- Folgas e bloqueios numa data específica.
-- provider_id null = fecha para o negócio inteiro (feriado).
-- start_time/end_time null = dia inteiro.
-- ------------------------------------------------------------
create table public.schedule_exceptions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  provider_id  uuid references public.providers(id) on delete cascade,
  exception_date date not null,
  start_time   time,
  end_time     time,
  reason       text,
  created_at   timestamptz not null default now(),
  check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time)
  )
);

create index schedule_exceptions_tenant_date_idx
  on public.schedule_exceptions(tenant_id, exception_date);

-- ------------------------------------------------------------
-- appointments: quem atende, o que é feito e quanto dura
-- ------------------------------------------------------------
alter table public.appointments
  add column if not exists provider_id uuid references public.providers(id) on delete set null,
  add column if not exists procedure_id uuid references public.procedures(id) on delete set null,
  add column if not exists duration_min integer not null default 30
    check (duration_min between 5 and 600);

-- Fim do atendimento. Não pode ser coluna gerada: "timestamptz + interval" é
-- stable (depende do fuso da sessão), e generated exige immutable. Preenchido
-- por trigger, então nenhum call site precisa lembrar de calcular.
alter table public.appointments
  add column if not exists ends_at timestamptz;

create or replace function public.appointments_set_ends_at()
returns trigger
language plpgsql
as $$
begin
  new.ends_at := new.scheduled_at + new.duration_min * interval '1 minute';
  return new;
end;
$$;

drop trigger if exists appointments_ends_at on public.appointments;
create trigger appointments_ends_at
  before insert or update of scheduled_at, duration_min
  on public.appointments
  for each row execute function public.appointments_set_ends_at();

update public.appointments
  set ends_at = scheduled_at + duration_min * interval '1 minute'
  where ends_at is null;

create index if not exists appointments_provider_slot_idx
  on public.appointments(provider_id, scheduled_at)
  where status = 'scheduled';

-- Duas consultas no mesmo profissional não podem se sobrepor. A checagem
-- também é feita na aplicação (mensagem amigável), mas a garantia real fica
-- aqui — imune a duas pessoas marcando o mesmo horário ao mesmo tempo.
create extension if not exists btree_gist;

alter table public.appointments
  drop constraint if exists appointments_no_overlap;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    provider_id with =,
    tstzrange(scheduled_at, ends_at) with &&
  ) where (status = 'scheduled' and provider_id is not null);

-- ------------------------------------------------------------
-- RLS — catálogo legível por quem é do tenant (o cliente precisa ver
-- profissional/procedimento/horário pra marcar). Escrita só via service role
-- (painel do dono e superadmin), como no resto do projeto.
-- ------------------------------------------------------------
alter table public.providers           enable row level security;
alter table public.procedures          enable row level security;
alter table public.provider_procedures enable row level security;
alter table public.provider_schedules  enable row level security;
alter table public.schedule_exceptions enable row level security;

create policy "providers_tenant_read" on public.providers
  for select using (tenant_id = public.auth_tenant_id());

create policy "procedures_tenant_read" on public.procedures
  for select using (tenant_id = public.auth_tenant_id());

create policy "provider_procedures_tenant_read" on public.provider_procedures
  for select using (tenant_id = public.auth_tenant_id());

create policy "provider_schedules_tenant_read" on public.provider_schedules
  for select using (tenant_id = public.auth_tenant_id());

create policy "schedule_exceptions_tenant_read" on public.schedule_exceptions
  for select using (tenant_id = public.auth_tenant_id());
