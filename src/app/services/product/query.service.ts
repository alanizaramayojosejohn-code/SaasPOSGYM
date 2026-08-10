import { inject, Injectable } from '@angular/core';
import { Product } from '../../models/product.model';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class ProductQueryService {
  private readonly client = inject(SupabaseService).client;

  // RLS filtra por business_id. Excluye soft-deleted.
  // Join con categories para incluir el objeto category en cada producto.
  // Devuelve activos e inactivos: el admin necesita ver ambos.
  async listProducts(): Promise<Product[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*, category:categories(id, name, description)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Product[];
  }

  // Solo los vendibles: para el POS y para los formularios de compras.
  async listActiveProducts(): Promise<Product[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*, category:categories(id, name, description)')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Product[];
  }

  // Búsqueda exacta por código de barras o SKU, para el escáner de caja.
  // Los índices únicos parciales (business_id, barcode) y (business_id, sku)
  // resuelven ambas ramas. RLS acota al negocio del usuario.
  async findByCode(code: string): Promise<Product | null> {
    const trimmed = code.trim();
    if (!trimmed) return null;

    // El valor va entre comillas dobles porque la coma y el punto son
    // separadores en la sintaxis de `or` de PostgREST. Las comillas y barras
    // del propio código se descartan: ningún código válido las lleva.
    const safe = trimmed.replace(/["\\]/g, '');
    if (!safe) return null;

    const { data, error } = await this.client
      .from('products')
      .select('*, category:categories(id, name, description)')
      .is('deleted_at', null)
      .eq('is_active', true)
      .or(`barcode.eq."${safe}",sku.eq."${safe}"`)
      .limit(1);
    if (error) throw error;
    return (data?.[0] as Product | undefined) ?? null;
  }
}
