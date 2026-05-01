-- =============================================================================
-- SaasGym · Step 2 — Aplicar migration 20260428010000_rls_role_separation
-- =============================================================================
-- Pega y ejecuta este script en el SQL Editor del dashboard. Es idempotente:
--  · `drop policy if exists` + `create policy` para reemplazar limpio.
--  · `create or replace function` para el nuevo helper.
-- No modifica datos. Solo redefine policies y agrega un helper.
--
-- Qué cambia:
--  · products / membership_plans / services / membership_plan_services:
--      SELECT abierto a admin+caja+super_admin (sigue como antes para SELECT).
--      INSERT/UPDATE/DELETE solo admin del tenant + super_admin.
--  · clients:
--      SELECT abierto. INSERT abierto a admin+caja (caja registra cliente
--      nuevo al vender membresía). UPDATE/DELETE solo admin.
--  · sales / client_memberships / attendance:
--      SELECT abierto. WRITE solo super_admin. El flujo normal va por RPCs
--      SECURITY DEFINER (register_*, cancel_sale) que bypass RLS, así que
--      esto NO rompe ninguna operación legítima.
-- =============================================================================

-- 1. Helper -----------------------------------------------------------------
create or replace function public.is_admin_in_business(p_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'super_admin'
        or (role = 'admin' and business_id = p_business_id)
      )
  );
$$;

-- 2. products ---------------------------------------------------------------
drop policy if exists "products_tenant"      on public.products;
drop policy if exists "products_select"      on public.products;
drop policy if exists "products_admin_write" on public.products;

create policy "products_select" on public.products
  for select to authenticated
  using (
    public.is_super_admin()
    or business_id = public.current_user_business_id()
  );

create policy "products_admin_write" on public.products
  for all to authenticated
  using (public.is_admin_in_business(business_id))
  with check (public.is_admin_in_business(business_id));

-- 3. membership_plans -------------------------------------------------------
drop policy if exists "membership_plans_tenant"      on public.membership_plans;
drop policy if exists "membership_plans_select"      on public.membership_plans;
drop policy if exists "membership_plans_admin_write" on public.membership_plans;

create policy "membership_plans_select" on public.membership_plans
  for select to authenticated
  using (
    public.is_super_admin()
    or business_id = public.current_user_business_id()
  );

create policy "membership_plans_admin_write" on public.membership_plans
  for all to authenticated
  using (public.is_admin_in_business(business_id))
  with check (public.is_admin_in_business(business_id));

-- 4. services ---------------------------------------------------------------
drop policy if exists "services_tenant"      on public.services;
drop policy if exists "services_select"      on public.services;
drop policy if exists "services_admin_write" on public.services;

create policy "services_select" on public.services
  for select to authenticated
  using (
    public.is_super_admin()
    or business_id = public.current_user_business_id()
  );

create policy "services_admin_write" on public.services
  for all to authenticated
  using (public.is_admin_in_business(business_id))
  with check (public.is_admin_in_business(business_id));

-- 5. membership_plan_services -----------------------------------------------
drop policy if exists "mps_tenant"      on public.membership_plan_services;
drop policy if exists "mps_select"      on public.membership_plan_services;
drop policy if exists "mps_admin_write" on public.membership_plan_services;

create policy "mps_select" on public.membership_plan_services
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.membership_plans p
      where p.id = plan_id and p.business_id = public.current_user_business_id()
    )
  );

create policy "mps_admin_write" on public.membership_plan_services
  for all to authenticated
  using (
    exists (
      select 1 from public.membership_plans p
      where p.id = plan_id and public.is_admin_in_business(p.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.membership_plans p
      where p.id = plan_id and public.is_admin_in_business(p.business_id)
    )
  );

-- 6. clients ----------------------------------------------------------------
drop policy if exists "clients_tenant"        on public.clients;
drop policy if exists "clients_select"        on public.clients;
drop policy if exists "clients_insert"        on public.clients;
drop policy if exists "clients_admin_update"  on public.clients;
drop policy if exists "clients_admin_delete"  on public.clients;

create policy "clients_select" on public.clients
  for select to authenticated
  using (
    public.is_super_admin()
    or business_id = public.current_user_business_id()
  );

create policy "clients_insert" on public.clients
  for insert to authenticated
  with check (
    public.is_super_admin()
    or business_id = public.current_user_business_id()
  );

create policy "clients_admin_update" on public.clients
  for update to authenticated
  using (public.is_admin_in_business(business_id))
  with check (public.is_admin_in_business(business_id));

create policy "clients_admin_delete" on public.clients
  for delete to authenticated
  using (public.is_admin_in_business(business_id));

-- 7. sales / client_memberships / attendance: write-lock salvo super_admin --
drop policy if exists "sales_tenant"             on public.sales;
drop policy if exists "sales_select"             on public.sales;
drop policy if exists "sales_super_admin_write"  on public.sales;

create policy "sales_select" on public.sales
  for select to authenticated
  using (
    public.is_super_admin()
    or business_id = public.current_user_business_id()
  );

create policy "sales_super_admin_write" on public.sales
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "client_memberships_tenant"             on public.client_memberships;
drop policy if exists "client_memberships_select"             on public.client_memberships;
drop policy if exists "client_memberships_super_admin_write"  on public.client_memberships;

create policy "client_memberships_select" on public.client_memberships
  for select to authenticated
  using (
    public.is_super_admin()
    or business_id = public.current_user_business_id()
  );

create policy "client_memberships_super_admin_write" on public.client_memberships
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "attendance_tenant"             on public.attendance;
drop policy if exists "attendance_select"             on public.attendance;
drop policy if exists "attendance_super_admin_write"  on public.attendance;

create policy "attendance_select" on public.attendance
  for select to authenticated
  using (
    public.is_super_admin()
    or business_id = public.current_user_business_id()
  );

create policy "attendance_super_admin_write" on public.attendance
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
