-- =============================================================================
-- SaasGym · Clientes: datos de facturación y reportes
--
-- `clients` ya guardaba ci, name y phone. Se agregan los datos que pide una
-- factura (NIT y razón social) más los de contacto, y el soft delete que el
-- resto de las entidades ya tiene.
--
-- CI y NIT conviven a propósito: el CI identifica a la persona (y es lo que se
-- usa para buscar al socio en caja), el NIT identifica a quién se le factura,
-- que puede ser una empresa distinta de la persona que compra.
-- =============================================================================

-- =============================================================================
-- 1. Columnas
-- =============================================================================

alter table public.clients
  add column nit           text,
  add column business_name text,
  add column email         text,
  add column address       text,
  add column birth_date    date,
  add column notes         text,
  add column is_active     boolean not null default true,
  add column deleted_at    timestamptz;

-- Los códigos vacíos se guardan como null, nunca como ''. Así el índice único
-- parcial no colisiona entre clientes sin NIT.
alter table public.clients
  add constraint clients_nit_not_blank
  check (nit is null or length(btrim(nit)) > 0);

alter table public.clients
  add constraint clients_business_name_not_blank
  check (business_name is null or length(btrim(business_name)) > 0);

-- Una fecha de nacimiento futura es siempre un error de tipeo.
alter table public.clients
  add constraint clients_birth_date_past
  check (birth_date is null or birth_date <= current_date);

-- =============================================================================
-- 2. Índices
-- =============================================================================

-- El NIT es único por negocio cuando está presente. Parcial en deleted_at para
-- que un cliente borrado libere su NIT.
create unique index idx_clients_nit_unique
  on public.clients(business_id, nit)
  where nit is not null and deleted_at is null;

-- Listados y búsqueda por CI, ya excluyendo los borrados.
create index idx_clients_active
  on public.clients(business_id)
  where deleted_at is null;

-- =============================================================================
-- 3. El CI único debe respetar el soft delete
-- =============================================================================
-- La restricción original `unique (business_id, ci)` es total: un cliente
-- borrado seguiría bloqueando su CI para siempre. Se reemplaza por un índice
-- único parcial, igual que el del NIT.

alter table public.clients drop constraint if exists clients_business_id_ci_key;

create unique index idx_clients_ci_unique
  on public.clients(business_id, ci)
  where deleted_at is null;

-- =============================================================================
-- 4. Vistas de reportes
-- =============================================================================
-- security_invoker: la RLS de clients y orders filtra por negocio.

-- 4.1 Resumen de compras por cliente.
--     Los pedidos anulados no cuentan: inflarían el total del cliente.
create or replace view public.client_purchase_summary
with (security_invoker = true) as
select
  c.id           as client_id,
  c.business_id,
  c.name,
  c.ci,
  c.nit,
  c.business_name,
  c.phone,
  c.email,
  c.is_active,
  c.created_at,
  count(o.id)                          as orders_count,
  coalesce(sum(o.total_amount), 0)     as total_spent,
  coalesce(avg(o.total_amount), 0)     as avg_ticket,
  max(o.created_at)                    as last_purchase_at,
  min(o.created_at)                    as first_purchase_at
from public.clients c
left join public.orders o
  on o.client_id = c.id
 and o.cancelled_at is null
where c.deleted_at is null
group by c.id;

-- 4.2 Altas de clientes por mes, para ver el crecimiento de la cartera.
create or replace view public.client_registrations_monthly
with (security_invoker = true) as
select
  c.business_id,
  date_trunc('month', c.created_at)::date as month,
  count(*)                                as clients_count,
  count(*) filter (where c.nit is not null) as with_nit_count
from public.clients c
where c.deleted_at is null
group by c.business_id, date_trunc('month', c.created_at);

revoke all on public.client_purchase_summary       from public, anon;
revoke all on public.client_registrations_monthly  from public, anon;

grant select on public.client_purchase_summary      to authenticated;
grant select on public.client_registrations_monthly to authenticated;
