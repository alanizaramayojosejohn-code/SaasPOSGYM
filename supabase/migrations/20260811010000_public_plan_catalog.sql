-- =============================================================================
-- SaasGym · Catálogo de planes visible sin sesión
--
-- La landing muestra los precios. Si solo `authenticated` puede leer `plans`,
-- la página pública tendría que traerlos duplicados en el código, y entonces
-- cambiar un precio dejaría de ser un UPDATE para volver a ser un despliegue —
-- que es justo lo que la tabla de catálogo venía a evitar.
--
-- Lo que se expone es la lista de precios pública: nombre, precio, cupos y
-- módulos. No hay dato de ningún negocio acá.
-- =============================================================================

drop policy if exists "plans_read" on public.plans;

-- Lectura para todos, incluido el visitante anónimo de la landing.
-- Solo los planes publicados: is_active = false sirve para preparar un plan
-- nuevo o retirar uno viejo sin que aparezca en la página.
create policy "plans_public_read" on public.plans
  for select
  to anon, authenticated
  using (is_active);

-- El super_admin ve también los despublicados, para poder editarlos.
create policy "plans_super_admin_read_all" on public.plans
  for select
  to authenticated
  using (public.is_super_admin());
