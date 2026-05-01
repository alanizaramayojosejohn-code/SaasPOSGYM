-- =============================================================================
-- SaasGym · Soft delete + cancelación de ventas/membresías
-- =============================================================================
-- Agrega:
--  · products.deleted_at         → soft delete de productos.
--  · sales.cancelled_at/by       → cancelar una venta (revierte stock o desactiva
--                                  la membresía asociada).
--  · client_memberships.cancelled_at → desactivar una membresía.
--
-- Las vistas y RPCs existentes filtran/respetan estos flags. Una RPC nueva
-- (`cancel_sale`) encapsula la cancelación con efectos colaterales.
-- =============================================================================

-- 1. Columnas nuevas ---------------------------------------------------------

alter table public.products
  add column deleted_at timestamptz;

alter table public.sales
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles(id) on delete set null;

alter table public.client_memberships
  add column cancelled_at timestamptz;

-- Índices parciales: la mayoría de queries filtran "no cancelado/no eliminado",
-- así indexamos solo los activos para mantener los índices chicos.
create index idx_products_active        on public.products(business_id) where deleted_at is null;
create index idx_sales_active           on public.sales(business_id, created_at) where cancelled_at is null;
create index idx_cm_active_not_cancelled on public.client_memberships(business_id, end_date) where cancelled_at is null;

-- 2. Vistas — filtran lo cancelado/eliminado --------------------------------

create or replace view public.income_daily
with (security_invoker = true) as
select
  business_id,
  date_trunc('day', created_at)::date as day,
  type,
  sum(amount) as total,
  count(*)    as transactions
from public.sales
where cancelled_at is null
group by business_id, date_trunc('day', created_at), type;

create or replace view public.monthly_income
with (security_invoker = true) as
select
  business_id,
  date_trunc('month', created_at)::date as month,
  type,
  count(*)    as transactions,
  sum(amount) as total
from public.sales
where cancelled_at is null
group by business_id, date_trunc('month', created_at), type;

create or replace view public.active_memberships
with (security_invoker = true) as
select
  cm.id                              as client_membership_id,
  cm.business_id,
  cm.client_id,
  c.ci                               as client_ci,
  c.name                             as client_name,
  c.phone                            as client_phone,
  cm.plan_id,
  mp.name                            as plan_name,
  mp.type                            as plan_type,
  cm.start_date,
  cm.end_date,
  cm.sessions_left,
  (cm.end_date - current_date)       as days_left
from public.client_memberships cm
join public.clients c          on c.id  = cm.client_id
join public.membership_plans mp on mp.id = cm.plan_id
where current_date between cm.start_date and cm.end_date
  and cm.cancelled_at is null;

create or replace view public.low_stock_products
with (security_invoker = true) as
select
  p.id,
  p.business_id,
  p.name,
  p.category,
  p.stock,
  p.price,
  p.cost,
  p.provider
from public.products p
where p.stock <= 5
  and p.deleted_at is null;

-- 3. RPCs existentes — respetan los nuevos flags ----------------------------

-- 3.1 register_sale_product: rechaza productos eliminados.
create or replace function public.register_sale_product(
  p_product_id uuid,
  p_quantity   integer default 1,
  p_client_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role     text;
  v_caller_business uuid;
  v_product         public.products%rowtype;
  v_sale_id         uuid;
  v_amount          numeric(12, 2);
begin
  v_caller_role     := public.current_user_role();
  v_caller_business := public.current_user_business_id();

  if v_caller_role not in ('admin', 'caja') then
    raise exception 'No autorizado';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null then
    raise exception 'Producto % no encontrado', p_product_id;
  end if;
  if v_product.deleted_at is not null then
    raise exception 'El producto fue eliminado y no puede venderse';
  end if;
  if v_product.business_id is distinct from v_caller_business then
    raise exception 'El producto pertenece a otro negocio';
  end if;
  if v_product.stock < p_quantity then
    raise exception 'Stock insuficiente (disponible: %, solicitado: %)', v_product.stock, p_quantity;
  end if;

  if p_client_id is not null then
    if not exists (
      select 1 from public.clients
      where id = p_client_id and business_id = v_caller_business
    ) then
      raise exception 'El cliente no pertenece a tu negocio';
    end if;
  end if;

  v_amount := v_product.price * p_quantity;

  update public.products
  set stock = stock - p_quantity
  where id = p_product_id;

  insert into public.sales (business_id, type, amount, quantity, client_id, product_id, created_by)
  values (v_caller_business, 'product', v_amount, p_quantity, p_client_id, p_product_id, auth.uid())
  returning id into v_sale_id;

  return v_sale_id;
end;
$$;

-- 3.2 register_attendance: solo considera membresías no canceladas.
create or replace function public.register_attendance(
  p_client_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role     text;
  v_caller_business uuid;
  v_caller_type     text;
  v_client_business uuid;
  v_membership      public.client_memberships%rowtype;
  v_attendance_id   uuid;
begin
  v_caller_role     := public.current_user_role();
  v_caller_business := public.current_user_business_id();
  v_caller_type     := public.current_user_business_type();

  if v_caller_role not in ('admin', 'caja') then
    raise exception 'No autorizado';
  end if;

  if v_caller_type is distinct from 'gym' then
    raise exception 'Asistencia solo está disponible en negocios de tipo gym';
  end if;

  select business_id into v_client_business from public.clients where id = p_client_id;
  if v_client_business is null then
    raise exception 'Cliente % no encontrado', p_client_id;
  end if;
  if v_client_business is distinct from v_caller_business then
    raise exception 'El cliente pertenece a otro negocio';
  end if;

  select * into v_membership
  from public.client_memberships
  where client_id = p_client_id
    and current_date between start_date and end_date
    and cancelled_at is null
  order by end_date desc
  limit 1;

  if v_membership.id is null then
    raise exception 'El cliente no tiene una membresía vigente';
  end if;

  if v_membership.sessions_left is not null then
    if v_membership.sessions_left <= 0 then
      raise exception 'La membresía no tiene sesiones disponibles';
    end if;
    update public.client_memberships
    set sessions_left = sessions_left - 1
    where id = v_membership.id;
  end if;

  insert into public.attendance (business_id, client_id, client_membership_id)
  values (v_caller_business, p_client_id, v_membership.id)
  returning id into v_attendance_id;

  return v_attendance_id;
end;
$$;

-- 4. RPC nueva: cancel_sale -------------------------------------------------
-- Cancela una venta y aplica los efectos colaterales según el tipo:
--  · product   → revierte stock si el producto sigue activo (no soft-deleted).
--  · membership → marca cancelled_at en la membresía asociada.
-- En ambos casos: marca sale.cancelled_at + cancelled_by.
-- Idempotente vía la guarda "ya está cancelada" + el filtro cancelled_at is null.
-- =============================================================================

create or replace function public.cancel_sale(
  p_sale_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role     text;
  v_caller_business uuid;
  v_sale            public.sales%rowtype;
begin
  v_caller_role     := public.current_user_role();
  v_caller_business := public.current_user_business_id();

  if v_caller_role not in ('admin', 'caja') then
    raise exception 'No autorizado';
  end if;

  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale.id is null then
    raise exception 'Venta % no encontrada', p_sale_id;
  end if;
  if v_sale.business_id is distinct from v_caller_business then
    raise exception 'La venta pertenece a otro negocio';
  end if;
  if v_sale.cancelled_at is not null then
    raise exception 'La venta ya está cancelada';
  end if;

  if v_sale.type = 'product' then
    update public.products
    set stock = stock + v_sale.quantity
    where id = v_sale.product_id
      and deleted_at is null;
  elsif v_sale.type = 'membership' then
    update public.client_memberships
    set cancelled_at = now()
    where id = v_sale.client_membership_id
      and cancelled_at is null;
  end if;

  update public.sales
  set cancelled_at = now(),
      cancelled_by = auth.uid()
  where id = p_sale_id;
end;
$$;

revoke all on function public.cancel_sale(uuid) from public;
grant execute on function public.cancel_sale(uuid) to authenticated;
