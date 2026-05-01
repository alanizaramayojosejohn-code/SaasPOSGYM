-- Personalización de tema por negocio.
-- preset: clave de paleta (definida en código, no en DB).
-- mode: 'light' | 'dark' | 'system'. 'system' sigue prefers-color-scheme del navegador.
-- Default 'monochrome' + 'system' = el diseño base B&W glass que llevamos en pencil.

alter table public.businesses
  add column if not exists theme jsonb not null default jsonb_build_object(
    'preset', 'monochrome',
    'mode', 'system'
  );

comment on column public.businesses.theme is
  'Tema visual del negocio. JSONB { preset: string, mode: light|dark|system }. '
  'Los presets validos se definen en src/app/services/theme/theme.presets.ts. '
  'Solo super_admin puede editar (RLS update ya restringe businesses al super_admin).';
