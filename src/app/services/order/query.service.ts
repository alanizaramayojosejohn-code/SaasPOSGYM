import { inject, Injectable } from '@angular/core';
import { OrderItemWithDetails, OrderWithDetails } from '../../models/order.model';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class OrderQueryService {
  private readonly client = inject(SupabaseService).client;

  // RLS filtra por business_id del caller.
  async listOrders(limit = 50): Promise<OrderWithDetails[]> {
    const { data, error } = await this.client
      .from('orders')
      .select(`
        *,
        clients(ci, name, nit, business_name),
        order_items(
          *,
          products(name),
          membership_plans(name),
          client_memberships(start_date, end_date)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    return (data ?? []).map((row: any) => {
      const { clients, order_items, ...order } = row;
      const items: OrderItemWithDetails[] = (order_items ?? []).map((item: any) => {
        const { products, membership_plans, client_memberships, ...rest } = item;
        return {
          ...rest,
          product_name: products?.name ?? null,
          plan_name: membership_plans?.name ?? null,
          start_date: client_memberships?.start_date ?? null,
          end_date: client_memberships?.end_date ?? null,
        };
      });
      return {
        ...order,
        client_label: clients ? `${clients.ci} · ${clients.name}` : null,
        client_nit: clients?.nit ?? null,
        client_business_name: clients?.business_name ?? null,
        items,
      } as OrderWithDetails;
    });
  }
}
