-- =============================================================================
-- SaasGym · Storage de imágenes de producto
--
-- Bucket `product-images`, público en lectura y restringido a admin en
-- escritura, con las imágenes segregadas por negocio en la ruta.
--
-- MODELO DE AMENAZA Y DEFENSAS
--
-- 1. Script alojado en el bucket (XSS almacenado).
--    Un SVG es un documento XML que puede traer <script>, y un archivo servido
--    como text/html se ejecuta en el origen del storage. La defensa es dura:
--    allowed_mime_types del bucket queda en ['image/webp'] únicamente. No es
--    una restricción cosmética del front — Storage rechaza en el servidor
--    cualquier subida cuyo content-type no sea ese, así que no hay forma de
--    alojar SVG, HTML ni JS aunque alguien llame a la API directamente.
--    El cliente ya convierte todo a WebP re-dibujando en canvas, con lo que el
--    archivo que sale del navegador nunca es el original.
--
-- 2. Escritura cruzada entre negocios.
--    La ruta obliga a `{business_id}/...` y las policies comprueban que ese
--    primer segmento sea un negocio donde el caller es admin.
--
-- 3. Agotamiento de espacio.
--    file_size_limit de 2 MB por objeto. Una imagen de producto en WebP pesa
--    decenas de KB; 2 MB es techo de seguridad, no el tamaño esperado.
--
-- 4. Lectura.
--    El bucket es público: el POS carga decenas de miniaturas por pantalla y
--    firmar cada URL agregaría una ida al servidor por imagen. Lo que se expone
--    es una foto de producto, no un dato sensible. La ruta lleva un uuid
--    aleatorio, así que no es enumerable.
-- =============================================================================

-- =============================================================================
-- 1. Helper: cast seguro a uuid
-- =============================================================================
-- Las policies leen el primer segmento de la ruta, que es texto arbitrario
-- controlado por quien sube. Un cast directo a uuid lanza excepción y aborta la
-- petición con un error de Postgres en vez de un 403 limpio; peor aún, hace
-- distinguible una ruta malformada de una no autorizada. Este wrapper devuelve
-- null y deja que la policy resuelva a false.

create or replace function public.safe_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_text::uuid;
exception
  when others then
    return null;
end;
$$;

-- =============================================================================
-- 2. Bucket
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,                 -- 2 MB
  array['image/webp']      -- solo WebP: cierra la puerta a SVG y a text/html
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- =============================================================================
-- 3. Policies sobre storage.objects
-- =============================================================================
-- La ruta es `{business_id}/{product_id}/{uuid}.webp`. storage.foldername()
-- devuelve los segmentos de carpeta; el primero identifica al tenant.

drop policy if exists "product_images_public_read" on storage.objects;
drop policy if exists "product_images_admin_insert" on storage.objects;
drop policy if exists "product_images_admin_update" on storage.objects;
drop policy if exists "product_images_admin_delete" on storage.objects;

-- Lectura pública: el bucket sirve miniaturas al POS.
create policy "product_images_public_read" on storage.objects
  for select
  to public
  using (bucket_id = 'product-images');

-- Escritura: solo admin, y solo dentro de la carpeta de su propio negocio.
create policy "product_images_admin_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_admin_in_business(
          public.safe_uuid((storage.foldername(name))[1])
        )
  );

create policy "product_images_admin_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_admin_in_business(
          public.safe_uuid((storage.foldername(name))[1])
        )
  )
  with check (
    bucket_id = 'product-images'
    and public.is_admin_in_business(
          public.safe_uuid((storage.foldername(name))[1])
        )
  );

create policy "product_images_admin_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_admin_in_business(
          public.safe_uuid((storage.foldername(name))[1])
        )
  );

-- =============================================================================
-- 4. products.image_path
-- =============================================================================
-- Se guarda la RUTA dentro del bucket, no la URL completa. La URL pública
-- incluye el dominio del proyecto: guardarla dejaría filas apuntando a un host
-- viejo si el proyecto se migra o el bucket se renombra. La URL se arma en
-- lectura a partir de la ruta.

alter table public.products
  add column image_path text;

-- La ruta tiene que estar dentro de la carpeta del propio negocio y terminar en
-- .webp. Es defensa en profundidad: aunque alguien escriba la fila a mano por
-- la API, no puede apuntar a un objeto de otro tenant ni a otro tipo de archivo.
alter table public.products
  add constraint products_image_path_shape
  check (
    image_path is null
    or image_path ~ ('^' || business_id::text || '/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.webp$')
  );

comment on column public.products.image_path is
  'Ruta dentro del bucket product-images: {business_id}/{product_id}/{uuid}.webp. La URL pública se arma en el cliente.';
