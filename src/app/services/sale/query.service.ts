import { inject, Injectable } from '@angular/core';
import { SaleWithDetails } from '../../models/sale.model';
import { SupabaseService } from '../supabase/supabase.service';

interface SaleRow {
  id: string;
  business_id: string;
  type: 'product' | 'membership';
  amount: number;
  quantity: number;
  client_id: string | null;
  product_id: string | null;
  client_membership_id: string | null;
  created_by: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  products: { name: string } | null;
  clients: { ci: string; name: string } | null;
  client_memberships: { membership_plans: { name: string } | null } | null;
}

@Injectable({ providedIn: 'root' })
export class SaleQueryService {
  private readonly client = inject(SupabaseService).client;

  // RLS filtra por business_id del caller.
  async listSales(limit = 50): Promise<SaleWithDetails[]> {
    const { data, error } = await this.client
      .from('sales')
      .select(`
        *,
        products(name),
        clients(ci, name),
        client_memberships(membership_plans(name))
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const rows = (data ?? []) as SaleRow[];
    return rows.map(({ products, clients, client_memberships, ...sale }) => ({
      ...sale,
      product_name: products?.name ?? null,
      plan_name: client_memberships?.membership_plans?.name ?? null,
      client_label: clients ? `${clients.ci} · ${clients.name}` : null,
    }));
  }
}
