import { inject, Injectable } from '@angular/core';
import { Product } from '../../models/product.model';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class ProductQueryService {
  private readonly client = inject(SupabaseService).client;

  // RLS filtra por business_id. Excluye soft-deleted.
  async listProducts(): Promise<Product[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Product[];
  }
}
