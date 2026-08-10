-- =============================================================================
-- SaasGym · Products: campos de identificación y venta en POS (Bloque 1)
--
-- Añade a `products`:
--   · short_name   → nombre corto para ticket y botones de caja
--   · sku          → código interno del negocio, único por tenant
--   · barcode      → código de barras para escaneo en caja, único por tenant
--   · is_active    → oculta del POS sin borrar (distinto de deleted_at)
--   · sale_unit    → unidad de venta (unidad, peso, volumen, paquete, caja)
--   · is_weighable → habilita cantidad decimal (fruta, granel)
--
-- Nota sobre is_weighable: la columna queda registrada, pero las cantidades
-- siguen siendo `int` en order_items / acquisition_items / purchase_order_items.
-- Vender por peso real requiere migrar esas columnas a numeric(12,3) junto con
-- register_order y las funciones de compras — trabajo aparte.
-- =============================================================================

-- =============================================================================
-- 1. Columnas
-- =============================================================================

alter table public.products
  add column short_name   text,
  add column sku          text,
  add column barcode      text,
  add column is_active    boolean not null default true,
  add column sale_unit    text    not null default 'unit',
  add column is_weighable boolean not null default false;

-- Unidades soportadas. 'unit' cubre el comportamiento actual de todos los
-- productos existentes.
alter table public.products
  add constraint products_sale_unit_check
  check (sale_unit in ('unit', 'kg', 'g', 'l', 'ml', 'pack', 'box'));

-- Solo peso y volumen admiten cantidad decimal; una unidad o una caja no.
alter table public.products
  add constraint products_weighable_unit_check
  check (not is_weighable or sale_unit in ('kg', 'g', 'l', 'ml'));

-- El código vacío se guarda como null, nunca como ''. Así el índice único
-- parcial no colisiona entre productos sin código.
alter table public.products
  add constraint products_sku_not_blank
  check (sku is null or length(btrim(sku)) > 0);

alter table public.products
  add constraint products_barcode_not_blank
  check (barcode is null or length(btrim(barcode)) > 0);

alter table public.products
  add constraint products_short_name_not_blank
  check (short_name is null or length(btrim(short_name)) > 0);

-- =============================================================================
-- 2. Unicidad por tenant
-- =============================================================================
-- Parciales: los productos soft-deleted liberan su código, de modo que se puede
-- volver a dar de alta un producto reutilizando el mismo SKU o código de barras.
-- Estos índices sirven además como índice de búsqueda para el escáner de caja.

create unique index idx_products_sku_unique
  on public.products(business_id, sku)
  where sku is not null and deleted_at is null;

create unique index idx_products_barcode_unique
  on public.products(business_id, barcode)
  where barcode is not null and deleted_at is null;

-- Listado del POS: activos y no eliminados.
create index idx_products_active_pos
  on public.products(business_id)
  where is_active and deleted_at is null;

-- =============================================================================
-- 3. Vista low_stock_products
-- =============================================================================
-- Un producto inactivo no se vende, así que no necesita reposición: se excluye
-- del reporte de bajo stock. Se mantienen las mismas columnas que antes para no
-- romper LowStockProduct en el front.

create or replace view public.low_stock_products
with (security_invoker = true) as
select
  p.id,
  p.business_id,
  p.name,
  c.name  as category,
  p.stock,
  p.price,
  p.cost,
  p.provider
from public.products p
left join public.categories c on c.id = p.category_id
where p.stock <= 5
  and p.deleted_at is null
  and p.is_active;

revoke all on public.low_stock_products from public, anon;
grant select on public.low_stock_products to authenticated;

-- =============================================================================
-- 4. register_order: rechazar productos inactivos
-- =============================================================================
-- Misma función que en 20260508000001, con una validación extra en la primera
-- pasada. El front ya los oculta del POS; esto cierra la puerta por si llega un
-- item con un producto desactivado entre la carga de la caja y el cobro.

create or replace function public.register_order(
  p_client_id      uuid    default null,
  p_payment_method text    default 'cash',
  p_items          jsonb   default '[]'::jsonb
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
  v_order_id        uuid;
  v_total           numeric(12,2) := 0;
  v_item            jsonb;
  v_item_type       text;
  v_product         public.products%rowtype;
  v_plan            public.membership_plans%rowtype;
  v_cm_id           uuid;
  v_end_date        date;
  v_start_date      date;
  v_quantity        int;
begin
  v_caller_role     := public.current_user_role();
  v_caller_business := public.current_user_business_id();
  v_caller_type     := public.current_user_business_type();

  if v_caller_role not in ('admin', 'caja') then
    raise exception 'No autorizado';
  end if;

  if p_payment_method not in ('cash', 'card', 'qr') then
    raise exception 'Método de pago inválido: %', p_payment_method;
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La orden debe tener al menos un ítem';
  end if;

  if p_client_id is not null then
    if not exists (
      select 1 from public.clients
      where id = p_client_id and business_id = v_caller_business
    ) then
      raise exception 'El cliente no pertenece a este negocio';
    end if;
  end if;

  -- Primera pasada: validar todo y calcular total
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_type := v_item->>'type';

    if v_item_type = 'product' then
      v_quantity := (v_item->>'quantity')::int;
      if coalesce(v_quantity, 0) <= 0 then
        raise exception 'La cantidad debe ser mayor a 0';
      end if;

      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid;

      if v_product.id is null then
        raise exception 'Producto % no encontrado', v_item->>'product_id';
      end if;
      if v_product.deleted_at is not null then
        raise exception 'El producto "%" fue eliminado', v_product.name;
      end if;
      if v_product.business_id is distinct from v_caller_business then
        raise exception 'El producto pertenece a otro negocio';
      end if;
      if not v_product.is_active then
        raise exception 'El producto "%" está inactivo', v_product.name;
      end if;
      -- Solo validar stock si el producto lo gestiona
      if v_product.has_stock and v_product.stock < v_quantity then
        raise exception 'Stock insuficiente para "%": disponible %, solicitado %',
          v_product.name, v_product.stock, v_quantity;
      end if;

      v_total := v_total + (v_product.price * v_quantity);

    elsif v_item_type = 'membership' then
      if v_caller_type is distinct from 'gym' then
        raise exception 'Las membresías solo están disponibles en negocios de tipo gym';
      end if;
      if p_client_id is null then
        raise exception 'Se requiere cliente para registrar una membresía';
      end if;

      select * into v_plan
      from public.membership_plans
      where id = (v_item->>'plan_id')::uuid;

      if v_plan.id is null then
        raise exception 'Plan % no encontrado', v_item->>'plan_id';
      end if;
      if v_plan.business_id is distinct from v_caller_business then
        raise exception 'El plan pertenece a otro negocio';
      end if;

      v_total := v_total + v_plan.price;
    else
      raise exception 'Tipo de ítem inválido: %', v_item_type;
    end if;
  end loop;

  -- Crear orden
  insert into public.orders (business_id, client_id, payment_method, total_amount, created_by)
  values (v_caller_business, p_client_id, p_payment_method, v_total, auth.uid())
  returning id into v_order_id;

  -- Segunda pasada: crear items y efectos colaterales
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_type := v_item->>'type';

    if v_item_type = 'product' then
      v_quantity := (v_item->>'quantity')::int;

      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid;

      insert into public.order_items (
        order_id, business_id, type, product_id, quantity, unit_price
      ) values (
        v_order_id, v_caller_business, 'product',
        v_product.id, v_quantity, v_product.price
      );

      -- Solo decrementar stock si el producto lo gestiona
      if v_product.has_stock then
        update public.products
        set stock = stock - v_quantity
        where id = v_product.id;
      end if;

    elsif v_item_type = 'membership' then
      v_start_date := coalesce((v_item->>'start_date')::date, current_date);

      select * into v_plan
      from public.membership_plans
      where id = (v_item->>'plan_id')::uuid;

      v_end_date := v_start_date + (v_plan.duration_days || ' days')::interval;

      insert into public.client_memberships (
        business_id, client_id, plan_id, start_date, end_date, sessions_left
      ) values (
        v_caller_business, p_client_id, v_plan.id,
        v_start_date, v_end_date, v_plan.sessions_number
      )
      returning id into v_cm_id;

      insert into public.order_items (
        order_id, business_id, type, plan_id, client_membership_id, quantity, unit_price
      ) values (
        v_order_id, v_caller_business, 'membership',
        v_plan.id, v_cm_id, 1, v_plan.price
      );
    end if;
  end loop;

  return v_order_id;
end;
$$;

grant execute on function public.register_order(uuid, text, jsonb) to authenticated;
