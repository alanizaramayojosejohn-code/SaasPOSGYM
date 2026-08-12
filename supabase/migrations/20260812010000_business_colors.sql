-- Simplifica la personalización de color del negocio a 2 colores elegidos
-- directamente por el super_admin al crear/editar el negocio (reemplaza el
-- diseño anterior de catálogos curados accent_colors/categorical_palettes,
-- que nunca llegó a usarse en producción).
--
-- El fondo deja de ser seleccionable por negocio: siempre monocromo
-- (negro/blanco según el modo claro/oscuro de cada usuario). Los 2 colores
-- del negocio (theme.color1 / theme.color2) son lo único personalizable, y
-- afectan botones, iconos de nombres en listados, gráficas y links.

drop table if exists public.categorical_palettes cascade;
drop table if exists public.accent_colors cascade;

alter table public.businesses
  alter column theme set default jsonb_build_object(
    'color1', '#0284c7',
    'color2', '#7c3aed'
  );

-- Normaliza los negocios existentes (traían { preset, mode } o el shape
-- intermedio { preset, accentColorId, categoricalPaletteId }) al nuevo shape.
update public.businesses
set theme = jsonb_build_object('color1', '#0284c7', 'color2', '#7c3aed')
where theme is null or not (theme ? 'color1' and theme ? 'color2');

comment on column public.businesses.theme is
  'Colores del negocio. JSONB { color1: hex, color2: hex }. Elegidos '
  'directamente por el super_admin en el form de alta/edición — no hay '
  'catálogo ni paletas de fondo seleccionables. RLS update ya restringe '
  'businesses al super_admin.';
