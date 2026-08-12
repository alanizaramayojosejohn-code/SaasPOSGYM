-- =============================================================================
-- SaasGym · Fix: my_plan_usage devolvía múltiples filas al super_admin
--
-- La vista original (20260811000000) no filtraba por negocio: confiaba en que
-- la RLS de `businesses` siempre acotara a una sola fila. Eso es cierto para
-- admin/caja (policy "businesses_tenant_read": id = current_user_business_id()),
-- pero el super_admin tiene además "businesses_super_admin_all", que le deja
-- ver TODOS los negocios. Con security_invoker=true, la vista hereda esa
-- visión completa y devuelve una fila por negocio — PlanService.load() usa
-- .maybeSingle(), que revienta con PGRST116 ("multiple rows returned") apenas
-- el super_admin inicia sesión.
--
-- El filtro explícito por business_id resuelve ambos casos a la vez: para
-- admin/caja sigue devolviendo su única fila (ya la tenían garantizada por
-- RLS, esto es cinturón y tirantes); para super_admin, current_user_business_id()
-- es null (no pertenece a ningún negocio) y la comparación no matchea nada,
-- así que la vista devuelve 0 filas — que es semánticamente correcto: el
-- super_admin no tiene un "plan" propio que medir.
-- =============================================================================

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
join public.plans p on p.code = b.plan_code
where b.id = public.current_user_business_id();

grant select on public.my_plan_usage to authenticated;
