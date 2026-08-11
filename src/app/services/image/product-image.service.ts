import { inject, Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ImageProcessorService, ProcessedImage } from './image-processor.service';

export const PRODUCT_IMAGES_BUCKET = 'product-images';

@Injectable({ providedIn: 'root' })
export class ProductImageService {
  private readonly client = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly processor = inject(ImageProcessorService);

  /**
   * Comprime y sube la imagen de un producto.
   *
   * La ruta es `{business_id}/{product_id}/{uuid}.webp`:
   *  - el primer segmento es lo que las policies de storage comparan contra el
   *    negocio del caller, así que un admin no puede escribir fuera del suyo;
   *  - el uuid final evita que subir una imagen nueva pise la anterior en la
   *    CDN, que serviría la vieja hasta que expire la caché.
   *
   * Devuelve la ruta, no la URL: en la fila del producto se guarda la ruta.
   */
  async upload(productId: string, file: File): Promise<{ path: string; processed: ProcessedImage }> {
    const businessId = this.auth.businessId();
    if (!businessId) throw new Error('Tu cuenta no tiene un negocio asignado.');

    const processed = await this.processor.process(file);
    const path = `${businessId}/${productId}/${crypto.randomUUID()}.webp`;

    const { error } = await this.client.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, processed.file, {
        contentType: 'image/webp',
        // Nunca sobrescribe: cada subida es un objeto nuevo.
        upsert: false,
        // Un año de caché. Cambiar la imagen cambia la ruta, así que no hay
        // riesgo de servir una versión vieja.
        cacheControl: '31536000',
      });

    if (error) throw translateStorageError(error);
    return { path, processed };
  }

  /**
   * Borra una imagen. No lanza si falla: se usa al reemplazar o al quitar, y
   * dejar un objeto huérfano es preferible a abortar la operación que el
   * usuario pidió. El error queda en consola para poder limpiarlo después.
   */
  async remove(path: string | null): Promise<void> {
    if (!path) return;
    const { error } = await this.client.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
    if (error) console.warn('No se pudo borrar la imagen del storage', path, error);
  }

  /** URL pública a partir de la ruta guardada. */
  publicUrl(path: string | null): string | null {
    if (!path) return null;
    const { data } = this.client.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
}

// Storage devuelve mensajes crudos; los tres casos que el admin puede provocar
// se traducen a algo accionable.
function translateStorageError(err: unknown): Error {
  const message = String((err as { message?: unknown })?.message ?? '');

  if (/mime type|content type/i.test(message)) {
    return new Error('El formato del archivo no está permitido. Solo se aceptan imágenes.');
  }
  if (/exceeded the maximum allowed size|payload too large/i.test(message)) {
    return new Error('La imagen comprimida sigue siendo demasiado grande.');
  }
  if (/row-level security|not authorized|violates/i.test(message)) {
    return new Error('No tienes permiso para subir imágenes en este negocio.');
  }
  return err instanceof Error ? err : new Error(message || 'Error al subir la imagen.');
}
