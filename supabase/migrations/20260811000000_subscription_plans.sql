-- =============================================================================
-- SaasGym · Planes, límites y estado de suscripción
--
-- DÓNDE SE APLICA EL LÍMITE, Y POR QUÉ
--
-- Toda la aplicación se hace con TRIGGERS, no con policies de RLS. La razón es
-- que las dos vías por las que hoy se escribe en la base saltan la RLS:
--
--   · Las funciones SECURITY DEFINER (register_order, register_attendance,
--     register_acquisition, …) corren como su dueño y no evalúan policies.
--   · La Edge Function create-business-user usa la service_role key, que
--     ignora la RLS por diseño.
--
-- Un trigger BEFORE se dispara en ambos casos. Además evita reescribir el
-- cuerpo de seis funciones existentes solo para insertarles un `if` al inicio,
-- que es una fuente de error mecánico.
--
-- Lo que la UI oculta es cortesía; esto es lo que de verdad cierra la puerta.
-- =============================================================================

-- =============================================================================
-- 1. Catálogo de planes
-- =============================================================================
-- Vive en tabla y no en un enum para poder cambiar precios y límites sin
-- desplegar. Los precios están en bolivianos: cotizar en dólares con la brecha
-- cambiaria vuelve el precio impredecible para el cliente.

create table public.plans (
  code           text primary key,
  name           text not null,
  description    text,
  price_monthly  numeric(12, 2) not null check (price_monthly >= 0),
  price_yearly   numeric(12, 2) check (price_yearly is null or price_yearly >= 0),

  -- null = ilimitado. 0 sería "ninguno", que es distinto.
  max_users      int check (max_users is null or max_users > 0),
  max_clients    int check (max_clients is null or max_clients > 0),
  max_products   int check (max_products is null or max_products > 0),

  features       text[] not null default '{}',
  sort_order     int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),

  -- Lista cerrada: un feature mal escrito en el catálogo abriría o cerraría un
  -- módulo en silencio, sin error visible en ningún lado.
  constraint plans_features_known check (
    features <@ array[
      'memberships',
      'purchases',
      'employees',
      'product_images',
      'client_reports',
      'payroll_reports'
    ]::text[]
  )
);

insert into public.plans (code, name, description, price_monthly, price_yearly, max_users, max_clients, max_products, features, sort_order) values
  ('basic', 'Básico',
   'Punto de venta, inventario y clientes. Para el negocio que recién ordena su operación.',
   149, 1490, 2, 150, 300,
   array[]::text[], 1),

  ('pro', 'Profesional',
   'Suma membresías, compras e imágenes de producto. Para el negocio que ya creció.',
   299, 2990, 4, null, null,
   array['memberships', 'purchases', 'product_images', 'client_reports']::text[], 2),

  ('full', 'Completo',
   'Todo, incluida la nómina del personal. Sin límite de usuarios.',
   499, 4990, null, null, null,
   array['memberships', 'purchases', 'product_images', 'client_reports', 'employees', 'payroll_reports']::text[], 3);

alter table public.plans enable row level security;

-- El catálogo lo lee cualquier usuario autenticado: la app necesita saber qué
-- ofrece el plan para pintar la UI y para el cartel de "mejora tu plan".
create policy "plans_read" on public.plans
  for select to authenticated
  using (true);

create policy "plans_super_admin_write" on public.plans
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =============================================================================
-- 2. Estado de suscripción del negocio
-- =============================================================================

alter table public.businesses
  add column plan_code           text references public.plans(code),
  add column subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'suspended', 'cancelled')),
  add column trial_ends_at       date,
  add column current_period_end  date,
  add column billing_notes       text;

-- Los negocios que ya existen no pueden quedar bloqueados por esta migración:
-- se les da el plan completo y un período largo. Ajustarlos es trabajo del
-- super_admin desde el panel, no de un despliegue.
update public.businesses
set plan_code           = 'full',
    subscription_status = 'active',
    current_period_end  = (current_date + interval '365 days')::date
where plan_code is null;

alter table public.businesses
  alter column plan_code set not null,
  alter column plan_code set default 'basic';

create index idx_businesses_subscription
  on public.businesses(subscription_status, current_period_end);

-- =============================================================================
-- 3. Helpers de suscripción
-- =============================================================================

-- Plan efectivo del negocio, ya resuelto contra el catálogo.
create or replace function public.business_plan(p_business_id uuid)
returns public.plans
language sql
security definer
stable
set search_path = public
as $$
  select p.*
  from public.businesses b
  join public.plans p on p.code = b.plan_code
  where b.id = p_business_id;
$$;

-- ¿El negocio puede escribir hoy?
--
-- 'past_due' SÍ puede escribir: es el período de gracia entre que vence y que
-- se corta. Cortarle la venta a un cliente que se atrasó tres días por un
-- feriado bancario es la forma más rápida de perderlo.
create or replace function public.business_can_write(p_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select case
      when b.subscription_status = 'trialing' then
        coalesce(b.trial_ends_at, current_date) >= current_date
      when b.subscription_status in ('active', 'past_due') then
        coalesce(b.current_period_end, current_date) >= current_date
      else false
    end
    from public.businesses b
    where b.id = p_business_id
  ), false);
$$;

-- ¿El plan del negocio incluye este módulo?
create or replace function public.business_has_feature(p_business_id uuid, p_feature text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select p_feature = any(p.features)
    from public.businesses b
    join public.plans p on p.code = b.plan_code
    where b.id = p_business_id
  ), false);
$$;

-- =============================================================================
-- 4. Trigger genérico: bloquear escrituras sin suscripción vigente
-- =============================================================================
-- Al vencer, el negocio queda en SOLO LECTURA. Nunca se borra ni se oculta su
-- información: puede seguir consultando su historial y sus reportes, que es lo
-- que le permite volver. Bloquear la lectura solo genera reclamos y no acelera
-- ningún pago.

create or replace function public.enforce_subscription_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_status      text;
begin
  v_business_id := case when TG_OP = 'DELETE' then OLD.business_id else NEW.business_id end;

  -- El super_admin opera por encima de la suscripción: es quien tiene que
  -- poder arreglar el estado de un tenant bloqueado.
  if public.is_super_admin() then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  if v_business_id is null or public.business_can_write(v_business_id) then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  select subscription_status into v_status
  from public.businesses where id = v_business_id;

  if v_status = 'trialing' then
    raise exception 'Tu período de prueba terminó. Activa un plan para seguir registrando información.'
      using errcode = 'check_violation';
  else
    raise exception 'Tu suscripción está vencida. El sistema quedó en solo lectura hasta que se regularice el pago.'
      using errcode = 'check_violation';
  end if;
end;
$$;

-- =============================================================================
-- 5. Trigger de features: bloquear módulos fuera del plan
-- =============================================================================
-- El nombre del módulo llega por TG_ARGV, así una sola función sirve para
-- todas las tablas.

create or replace function public.enforce_plan_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_feature     text := TG_ARGV[0];
  v_plan_name   text;
begin
  v_business_id := case when TG_OP = 'DELETE' then OLD.business_id else NEW.business_id end;

  if public.is_super_admin() then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  if v_business_id is null or public.business_has_feature(v_business_id, v_feature) then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  select p.name into v_plan_name
  from public.businesses b join public.plans p on p.code = b.plan_code
  where b.id = v_business_id;

  raise exception 'El módulo % no está incluido en el plan %. Mejora tu plan para habilitarlo.',
    v_feature, coalesce(v_plan_name, 'actual')
    using errcode = 'check_violation';
end;
$$;

-- =============================================================================
-- 6. Triggers de cupo
-- =============================================================================
-- Se cuentan filas vivas, no históricas: un cliente borrado no debe consumir
-- cupo. El conteo se hace dentro del trigger y no en una policy porque la
-- Edge Function que crea usuarios usa service_role y saltaría la RLS.

create or replace function public.enforce_user_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max   int;
  v_count int;
begin
  -- El super_admin no pertenece a ningún negocio y no consume cupo.
  if NEW.business_id is null or NEW.role = 'super_admin' then
    return NEW;
  end if;
  if public.is_super_admin() then
    return NEW;
  end if;

  select max_users into v_max from public.business_plan(NEW.business_id);
  if v_max is null then
    return NEW;
  end if;

  select count(*) into v_count from public.profiles where business_id = NEW.business_id;

  if v_count >= v_max then
    raise exception 'Tu plan permite % usuarios y ya tienes %. Mejora tu plan para agregar más.',
      v_max, v_count
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$$;

create or replace function public.enforce_client_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max   int;
  v_count int;
begin
  if public.is_super_admin() then
    return NEW;
  end if;

  select max_clients into v_max from public.business_plan(NEW.business_id);
  if v_max is null then
    return NEW;
  end if;

  select count(*) into v_count
  from public.clients
  where business_id = NEW.business_id and deleted_at is null;

  if v_count >= v_max then
    raise exception 'Tu plan permite % clientes y ya tienes %. Mejora tu plan para registrar más.',
      v_max, v_count
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$$;

create or replace function public.enforce_product_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max   int;
  v_count int;
begin
  if public.is_super_admin() then
    return NEW;
  end if;

  select max_products into v_max from public.business_plan(NEW.business_id);
  if v_max is null then
    return NEW;
  end if;

  select count(*) into v_count
  from public.products
  where business_id = NEW.business_id and deleted_at is null;

  if v_count >= v_max then
    raise exception 'Tu plan permite % productos y ya tienes %. Mejora tu plan para cargar más.',
      v_max, v_count
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$$;

-- La imagen de producto es una feature: se valida al setear image_path, no al
-- crear el producto, porque el producto sin imagen sí está permitido.
create or replace function public.enforce_product_image_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.image_path is null or public.is_super_admin() then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and NEW.image_path is not distinct from OLD.image_path then
    return NEW;
  end if;
  if not public.business_has_feature(NEW.business_id, 'product_images') then
    raise exception 'Las imágenes de producto no están incluidas en tu plan. Mejora tu plan para habilitarlas.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$$;

-- =============================================================================
-- 7. Aplicación de los triggers
-- =============================================================================

-- 7.1 Solo lectura al vencer, sobre todas las tablas operativas del tenant.
do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'categories', 'clients',
    'membership_plans', 'services', 'client_memberships', 'attendance',
    'orders',
    'employees', 'employee_deductions', 'employee_payments',
    'suppliers', 'acquisitions', 'purchase_orders'
  ] loop
    -- La lista se recorre comprobando existencia: `sales` fue reemplazada por
    -- `orders` en 20260508000000 y no queremos que este bloque se rompa cada
    -- vez que el esquema se reorganice.
    if to_regclass('public.' || t) is null then
      raise notice 'Tabla % no existe, se omite el trigger de suscripción', t;
      continue;
    end if;
    execute format(
      'create trigger trg_%1$s_subscription
         before insert or update or delete on public.%1$I
         for each row execute function public.enforce_subscription_write()', t);
  end loop;
end;
$$;

-- 7.2 Módulos por plan.
create trigger trg_employees_feature
  before insert or update on public.employees
  for each row execute function public.enforce_plan_feature('employees');

create trigger trg_employee_deductions_feature
  before insert or update on public.employee_deductions
  for each row execute function public.enforce_plan_feature('employees');

create trigger trg_employee_payments_feature
  before insert or update on public.employee_payments
  for each row execute function public.enforce_plan_feature('employees');

create trigger trg_suppliers_feature
  before insert or update on public.suppliers
  for each row execute function public.enforce_plan_feature('purchases');

create trigger trg_acquisitions_feature
  before insert or update on public.acquisitions
  for each row execute function public.enforce_plan_feature('purchases');

create trigger trg_purchase_orders_feature
  before insert or update on public.purchase_orders
  for each row execute function public.enforce_plan_feature('purchases');

create trigger trg_membership_plans_feature
  before insert or update on public.membership_plans
  for each row execute function public.enforce_plan_feature('memberships');

create trigger trg_client_memberships_feature
  before insert or update on public.client_memberships
  for each row execute function public.enforce_plan_feature('memberships');

create trigger trg_attendance_feature
  before insert or update on public.attendance
  for each row execute function public.enforce_plan_feature('memberships');

-- 7.3 Cupos.
create trigger trg_profiles_user_limit
  before insert on public.profiles
  for each row execute function public.enforce_user_limit();

create trigger trg_clients_limit
  before insert on public.clients
  for each row execute function public.enforce_client_limit();

create trigger trg_products_limit
  before insert on public.products
  for each row execute function public.enforce_product_limit();

create trigger trg_products_image_feature
  before insert or update on public.products
  for each row execute function public.enforce_product_image_feature();

-- =============================================================================
-- 8. Pagos de suscripción
-- =============================================================================
-- En Bolivia el cobro real es QR Simple o transferencia, conciliado a mano. La
-- tabla guarda el comprobante para poder responder cuando el cliente reclama.

create table public.subscription_payments (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  plan_code    text not null references public.plans(code),

  amount       numeric(12, 2) not null check (amount >= 0),
  method       text not null default 'qr'
    check (method in ('qr', 'transfer', 'cash', 'card', 'other')),
  reference    text,

  period_start date not null,
  period_end   date not null,
  paid_on      date not null default current_date,
  notes        text,

  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint subscription_payments_period_order check (period_end >= period_start)
);

create index idx_sub_payments_business on public.subscription_payments(business_id, paid_on desc);

alter table public.subscription_payments enable row level security;

-- El negocio ve sus propios pagos (para reclamar con el comprobante en mano);
-- solo el super_admin los registra.
create policy "subscription_payments_read" on public.subscription_payments
  for select to authenticated
  using (
    public.is_super_admin()
    or business_id = public.current_user_business_id()
  );

create policy "subscription_payments_super_admin_write" on public.subscription_payments
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =============================================================================
-- 9. register_subscription_payment
-- =============================================================================
-- Registra el cobro y extiende el período en una sola transacción. Separar las
-- dos cosas dejaría negocios pagados pero bloqueados si el segundo paso falla.
--
-- El período nuevo arranca desde el vencimiento vigente, no desde hoy: si el
-- cliente paga antes de tiempo no pierde los días que le quedaban.

create or replace function public.register_subscription_payment(
  p_business_id uuid,
  p_plan_code   text,
  p_amount      numeric,
  p_months      int     default 1,
  p_method      text    default 'qr',
  p_reference   text    default null,
  p_paid_on     date    default current_date,
  p_notes       text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business     public.businesses%rowtype;
  v_period_start date;
  v_period_end   date;
  v_payment_id   uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Solo el administrador de la plataforma puede registrar pagos de suscripción';
  end if;

  if coalesce(p_months, 0) <= 0 then
    raise exception 'La cantidad de meses debe ser mayor a 0';
  end if;
  if coalesce(p_amount, -1) < 0 then
    raise exception 'El monto no puede ser negativo';
  end if;

  select * into v_business from public.businesses where id = p_business_id;
  if v_business.id is null then
    raise exception 'Negocio no encontrado';
  end if;

  if not exists (select 1 from public.plans where code = p_plan_code) then
    raise exception 'El plan % no existe', p_plan_code;
  end if;

  -- Si todavía está vigente, se acumula; si ya venció, arranca hoy.
  v_period_start := greatest(coalesce(v_business.current_period_end, current_date), current_date);
  v_period_end   := (v_period_start + (p_months || ' months')::interval)::date;

  insert into public.subscription_payments (
    business_id, plan_code, amount, method, reference,
    period_start, period_end, paid_on, notes, created_by
  ) values (
    p_business_id, p_plan_code, p_amount, p_method, p_reference,
    v_period_start, v_period_end, coalesce(p_paid_on, current_date), p_notes, auth.uid()
  )
  returning id into v_payment_id;

  update public.businesses
  set plan_code           = p_plan_code,
      subscription_status = 'active',
      current_period_end  = v_period_end
  where id = p_business_id;

  return v_payment_id;
end;
$$;

-- Cambio de plan o de estado sin cobro de por medio (correcciones, cortesías,
-- suspensión manual por falta de pago).
create or replace function public.set_business_subscription(
  p_business_id uuid,
  p_plan_code   text default null,
  p_status      text default null,
  p_period_end  date default null,
  p_trial_ends  date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Solo el administrador de la plataforma puede cambiar la suscripción';
  end if;

  if p_plan_code is not null and not exists (select 1 from public.plans where code = p_plan_code) then
    raise exception 'El plan % no existe', p_plan_code;
  end if;
  if p_status is not null and p_status not in ('trialing','active','past_due','suspended','cancelled') then
    raise exception 'Estado de suscripción inválido: %', p_status;
  end if;

  update public.businesses
  set plan_code           = coalesce(p_plan_code, plan_code),
      subscription_status = coalesce(p_status, subscription_status),
      current_period_end  = coalesce(p_period_end, current_period_end),
      trial_ends_at       = coalesce(p_trial_ends, trial_ends_at)
  where id = p_business_id;
end;
$$;

grant execute on function public.register_subscription_payment(uuid, text, numeric, int, text, text, date, text) to authenticated;
grant execute on function public.set_business_subscription(uuid, text, text, date, date) to authenticated;

-- =============================================================================
-- 10. Vistas
-- =============================================================================

-- 10.1 Estado de cada negocio, para el panel del super_admin.
create or replace view public.subscription_overview
with (security_invoker = true) as
select
  b.id                as business_id,
  b.name,
  b.type,
  b.plan_code,
  p.name              as plan_name,
  p.price_monthly,
  b.subscription_status,
  b.trial_ends_at,
  b.current_period_end,
  b.created_at,
  -- Días que faltan para el corte. Negativo = ya venció.
  case
    when b.subscription_status = 'trialing' then b.trial_ends_at - current_date
    else b.current_period_end - current_date
  end                 as days_left,
  public.business_can_write(b.id) as can_write,
  (select count(*) from public.profiles pr where pr.business_id = b.id)                        as users_count,
  (select count(*) from public.clients c  where c.business_id = b.id and c.deleted_at is null) as clients_count,
  (select count(*) from public.products pd where pd.business_id = b.id and pd.deleted_at is null) as products_count,
  p.max_users,
  p.max_clients,
  p.max_products,
  (select coalesce(sum(sp.amount), 0) from public.subscription_payments sp where sp.business_id = b.id) as total_paid
from public.businesses b
join public.plans p on p.code = b.plan_code
-- Vista de plataforma: solo el super_admin. Sin este filtro, un admin de
-- negocio recibiría su propia fila (la RLS de businesses se lo permite) y el
-- panel de cobranza devolvería datos a quien no le corresponde consultarlo.
where public.is_super_admin();

-- 10.2 Uso del propio negocio, para pintar "120 de 150 clientes" en la app.
create or replace view public.my_plan_usage
with (security_invoker = true) as
select
  b.id                as business_id,
  b.plan_code,
  p.name              as plan_name,
  p.price_monthly,
  p.features,
  b.subscription_status,
  b.trial_ends_at,
  b.current_period_end,
  case
    when b.subscription_status = 'trialing' then b.trial_ends_at - current_date
    else b.current_period_end - current_date
  end                 as days_left,
  public.business_can_write(b.id) as can_write,
  p.max_users,
  p.max_clients,
  p.max_products,
  (select count(*) from public.profiles pr where pr.business_id = b.id)                        as users_count,
  (select count(*) from public.clients c  where c.business_id = b.id and c.deleted_at is null) as clients_count,
  (select count(*) from public.products pd where pd.business_id = b.id and pd.deleted_at is null) as products_count
from public.businesses b
join public.plans p on p.code = b.plan_code;

revoke all on public.subscription_overview from public, anon;
revoke all on public.my_plan_usage        from public, anon;
grant select on public.subscription_overview to authenticated;
grant select on public.my_plan_usage        to authenticated;
