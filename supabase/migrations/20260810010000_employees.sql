-- =============================================================================
-- SaasGym · Empleados, pagos de sueldo y descuentos
--
-- DECISIÓN DE DISEÑO: `employees` es una tabla propia, NO una extensión de
-- `profiles`.
--
-- `profiles` es la cuenta de acceso al panel: exige una fila en auth.users y
-- se crea por Edge Function con email y password. Un gimnasio tiene personal
-- que cobra sueldo pero nunca entra al sistema (limpieza, entrenadores). Atar
-- la nómina a `profiles` obligaría a inventarles un usuario y una contraseña
-- para poder pagarles.
--
-- Por eso el empleado existe solo, y `profile_id` lo enlaza de forma opcional
-- con su cuenta del panel cuando además es admin o caja.
--
-- RLS: todo este módulo es SOLO ADMIN, en lectura y escritura. Los sueldos no
-- los ve la caja.
-- =============================================================================

-- =============================================================================
-- 1. Empleados
-- =============================================================================

create table public.employees (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  -- Enlace opcional con la cuenta del panel. on delete set null: borrar el
  -- acceso no borra al empleado ni su historial de pagos.
  profile_id       uuid unique references public.profiles(id) on delete set null,

  name             text not null,
  ci               text not null,
  position         text,
  phone            text,
  email            text,

  hire_date        date not null default current_date,
  termination_date date,

  salary_type      text not null default 'monthly'
    check (salary_type in ('monthly', 'hourly', 'commission')),
  base_salary      numeric(12, 2) not null default 0 check (base_salary >= 0),

  is_active        boolean not null default true,
  notes            text,

  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint employees_name_not_blank check (length(btrim(name)) > 0),
  constraint employees_ci_not_blank   check (length(btrim(ci)) > 0),
  -- La baja no puede ser anterior al ingreso.
  constraint employees_dates_order check (
    termination_date is null or termination_date >= hire_date
  )
);

-- El CI identifica a la persona dentro del negocio. Parcial: un empleado
-- borrado libera su CI por si vuelve a contratarse.
create unique index idx_employees_ci_unique
  on public.employees(business_id, ci)
  where deleted_at is null;

create index idx_employees_business on public.employees(business_id)
  where deleted_at is null;
create index idx_employees_active on public.employees(business_id)
  where is_active and deleted_at is null;

-- =============================================================================
-- 2. Descuentos
-- =============================================================================
-- Un descuento nace suelto (payment_id null = pendiente) y se engancha a un
-- pago cuando se liquida el período. Así el admin puede ir cargando adelantos
-- y faltas durante el mes y aplicarlos todos juntos al pagar.

create table public.employee_deductions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  -- null mientras está pendiente de aplicar.
  payment_id   uuid,

  type         text not null
    check (type in ('advance', 'absence', 'late', 'loan', 'tax', 'social_security', 'other')),
  amount       numeric(12, 2) not null check (amount > 0),
  description  text,
  applied_on   date not null default current_date,

  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index idx_deductions_employee on public.employee_deductions(employee_id, applied_on desc);
create index idx_deductions_pending  on public.employee_deductions(employee_id)
  where payment_id is null;
create index idx_deductions_payment  on public.employee_deductions(payment_id);

-- =============================================================================
-- 3. Pagos de sueldo
-- =============================================================================

create table public.employee_payments (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  employee_id       uuid not null references public.employees(id) on delete restrict,

  period_start      date not null,
  period_end        date not null,

  gross_amount      numeric(12, 2) not null check (gross_amount >= 0),
  bonus_amount      numeric(12, 2) not null default 0 check (bonus_amount >= 0),
  deductions_amount numeric(12, 2) not null default 0 check (deductions_amount >= 0),
  net_amount        numeric(12, 2) not null,

  payment_method    text not null default 'cash'
    check (payment_method in ('cash', 'transfer', 'check')),
  paid_on           date not null default current_date,
  status            text not null default 'paid'
    check (status in ('paid', 'cancelled')),
  notes             text,

  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  cancelled_at      timestamptz,
  cancelled_by      uuid references public.profiles(id) on delete set null,

  constraint employee_payments_period_order check (period_end >= period_start)
);

create index idx_emp_payments_employee on public.employee_payments(employee_id, period_start desc);
create index idx_emp_payments_business on public.employee_payments(business_id, paid_on desc);

-- La FK circular se agrega después de crear ambas tablas.
alter table public.employee_deductions
  add constraint employee_deductions_payment_fkey
  foreign key (payment_id) references public.employee_payments(id) on delete set null;

-- =============================================================================
-- 4. RLS — solo admin del tenant (super_admin siempre pasa)
-- =============================================================================

alter table public.employees            enable row level security;
alter table public.employee_deductions  enable row level security;
alter table public.employee_payments    enable row level security;

create policy "employees_admin_all" on public.employees
  for all to authenticated
  using  (public.is_admin_in_business(business_id))
  with check (public.is_admin_in_business(business_id));

create policy "employee_deductions_admin_all" on public.employee_deductions
  for all to authenticated
  using  (public.is_admin_in_business(business_id))
  with check (public.is_admin_in_business(business_id));

create policy "employee_payments_admin_all" on public.employee_payments
  for all to authenticated
  using  (public.is_admin_in_business(business_id))
  with check (public.is_admin_in_business(business_id));

-- =============================================================================
-- 5. register_employee_payment
-- =============================================================================
-- Liquida un período en una sola transacción: valida el empleado, engancha los
-- descuentos pendientes que se le pasen, suma, calcula el neto e inserta el
-- pago. Es el único camino de escritura de employee_payments desde el front:
-- calcular el neto en el cliente permitiría guardar un pago que no cuadra con
-- sus propios descuentos.

create or replace function public.register_employee_payment(
  p_employee_id   uuid,
  p_period_start  date,
  p_period_end    date,
  p_gross_amount  numeric   default 0,
  p_bonus_amount  numeric   default 0,
  p_deduction_ids uuid[]    default '{}',
  p_method        text      default 'cash',
  p_paid_on       date      default current_date,
  p_notes         text      default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_business uuid;
  v_employee        public.employees%rowtype;
  v_deductions      numeric(12,2) := 0;
  v_net             numeric(12,2);
  v_payment_id      uuid;
  v_count           int;
begin
  v_caller_business := public.current_user_business_id();

  if not public.is_admin_in_business(v_caller_business) then
    raise exception 'No autorizado';
  end if;

  if p_method not in ('cash', 'transfer', 'check') then
    raise exception 'Método de pago inválido: %', p_method;
  end if;

  if p_period_end < p_period_start then
    raise exception 'El fin del período no puede ser anterior al inicio';
  end if;

  if coalesce(p_gross_amount, 0) < 0 or coalesce(p_bonus_amount, 0) < 0 then
    raise exception 'Los montos no pueden ser negativos';
  end if;

  select * into v_employee from public.employees where id = p_employee_id;

  if v_employee.id is null then
    raise exception 'Empleado no encontrado';
  end if;
  if v_employee.business_id is distinct from v_caller_business then
    raise exception 'El empleado pertenece a otro negocio';
  end if;
  if v_employee.deleted_at is not null then
    raise exception 'El empleado "%" fue eliminado', v_employee.name;
  end if;

  -- Los descuentos deben ser de este empleado y estar pendientes. Si alguno no
  -- cumple, la cuenta saldría mal: se aborta en vez de ignorarlo en silencio.
  if array_length(p_deduction_ids, 1) is not null then
    select count(*), coalesce(sum(amount), 0)
      into v_count, v_deductions
    from public.employee_deductions
    where id = any(p_deduction_ids)
      and employee_id = p_employee_id
      and business_id = v_caller_business
      and payment_id is null;

    if v_count <> array_length(p_deduction_ids, 1) then
      raise exception 'Hay descuentos que no existen, ya fueron pagados o son de otro empleado';
    end if;
  end if;

  v_net := coalesce(p_gross_amount, 0) + coalesce(p_bonus_amount, 0) - v_deductions;

  if v_net < 0 then
    raise exception 'Los descuentos (%) superan el total a pagar (%)',
      v_deductions, coalesce(p_gross_amount, 0) + coalesce(p_bonus_amount, 0);
  end if;

  insert into public.employee_payments (
    business_id, employee_id, period_start, period_end,
    gross_amount, bonus_amount, deductions_amount, net_amount,
    payment_method, paid_on, notes, created_by
  ) values (
    v_caller_business, p_employee_id, p_period_start, p_period_end,
    coalesce(p_gross_amount, 0), coalesce(p_bonus_amount, 0), v_deductions, v_net,
    p_method, coalesce(p_paid_on, current_date), p_notes, auth.uid()
  )
  returning id into v_payment_id;

  update public.employee_deductions
  set payment_id = v_payment_id
  where id = any(p_deduction_ids);

  return v_payment_id;
end;
$$;

-- =============================================================================
-- 6. cancel_employee_payment
-- =============================================================================
-- Anula el pago y devuelve sus descuentos al estado pendiente, para que se
-- puedan aplicar en la liquidación corregida.

create or replace function public.cancel_employee_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_business uuid;
  v_payment         public.employee_payments%rowtype;
begin
  v_caller_business := public.current_user_business_id();

  if not public.is_admin_in_business(v_caller_business) then
    raise exception 'No autorizado';
  end if;

  select * into v_payment from public.employee_payments where id = p_payment_id;

  if v_payment.id is null then
    raise exception 'Pago no encontrado';
  end if;
  if v_payment.business_id is distinct from v_caller_business then
    raise exception 'El pago pertenece a otro negocio';
  end if;
  if v_payment.status = 'cancelled' then
    raise exception 'El pago ya está anulado';
  end if;

  update public.employee_deductions
  set payment_id = null
  where payment_id = p_payment_id;

  update public.employee_payments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid()
  where id = p_payment_id;
end;
$$;

grant execute on function public.register_employee_payment(uuid, date, date, numeric, numeric, uuid[], text, date, text) to authenticated;
grant execute on function public.cancel_employee_payment(uuid) to authenticated;

-- =============================================================================
-- 7. Vistas de reportes
-- =============================================================================
-- security_invoker: la RLS de las tablas base filtra por negocio y por rol
-- admin, así que las vistas heredan la restricción sin repetirla.

-- 7.1 Resumen por empleado: cuánto se le pagó y cuánto se le descontó.
create or replace view public.employee_payroll_summary
with (security_invoker = true) as
select
  e.id                as employee_id,
  e.business_id,
  e.name,
  e.ci,
  e.position,
  e.salary_type,
  e.base_salary,
  e.is_active,
  e.hire_date,
  count(p.id) filter (where p.status = 'paid')                as payments_count,
  coalesce(sum(p.gross_amount)      filter (where p.status = 'paid'), 0) as total_gross,
  coalesce(sum(p.bonus_amount)      filter (where p.status = 'paid'), 0) as total_bonus,
  coalesce(sum(p.deductions_amount) filter (where p.status = 'paid'), 0) as total_deductions,
  coalesce(sum(p.net_amount)        filter (where p.status = 'paid'), 0) as total_net,
  max(p.paid_on) filter (where p.status = 'paid')             as last_payment_on,
  -- Descuentos cargados que todavía no entraron en ninguna liquidación.
  coalesce((
    select sum(d.amount)
    from public.employee_deductions d
    where d.employee_id = e.id and d.payment_id is null
  ), 0) as pending_deductions
from public.employees e
left join public.employee_payments p on p.employee_id = e.id
where e.deleted_at is null
group by e.id;

-- 7.2 Nómina por mes: lo que costó el personal cada mes.
create or replace view public.employee_payroll_monthly
with (security_invoker = true) as
select
  p.business_id,
  date_trunc('month', p.paid_on)::date as month,
  count(*)                             as payments_count,
  count(distinct p.employee_id)        as employees_count,
  sum(p.gross_amount)                  as total_gross,
  sum(p.bonus_amount)                  as total_bonus,
  sum(p.deductions_amount)             as total_deductions,
  sum(p.net_amount)                    as total_net
from public.employee_payments p
where p.status = 'paid'
group by p.business_id, date_trunc('month', p.paid_on);

-- 7.3 Descuentos agrupados por tipo: para ver de dónde salen.
create or replace view public.employee_deductions_by_type
with (security_invoker = true) as
select
  d.business_id,
  d.type,
  count(*)          as deductions_count,
  sum(d.amount)     as total_amount,
  count(*) filter (where d.payment_id is null)                    as pending_count,
  coalesce(sum(d.amount) filter (where d.payment_id is null), 0)   as pending_amount
from public.employee_deductions d
group by d.business_id, d.type;

revoke all on public.employee_payroll_summary    from public, anon;
revoke all on public.employee_payroll_monthly    from public, anon;
revoke all on public.employee_deductions_by_type from public, anon;

grant select on public.employee_payroll_summary    to authenticated;
grant select on public.employee_payroll_monthly    to authenticated;
grant select on public.employee_deductions_by_type to authenticated;
