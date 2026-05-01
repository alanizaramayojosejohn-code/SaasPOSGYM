import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';

export interface RegisterSaleProductInput {
  product_id: string;
  quantity: number;
  client_id: string | null;
}

export interface RegisterSaleMembershipInput {
  client_id: string;
  plan_id: string;
  start_date: string | null; // ISO yyyy-MM-dd; null = current_date (lo decide el RPC)
}

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly client = inject(SupabaseService).client;

  // RPC register_sale_product: valida stock, decrementa stock, crea sale.
  async registerSaleProduct(input: RegisterSaleProductInput): Promise<string> {
    const { data, error } = await this.client.rpc('register_sale_product', {
      p_product_id: input.product_id,
      p_quantity: input.quantity,
      p_client_id: input.client_id,
    });
    if (error) throw error;
    return data as string;
  }

  // RPC register_sale_membership: asigna membresía al cliente y registra venta.
  // Devuelve client_membership_id (más útil que sale_id en este flujo).
  async registerSaleMembership(input: RegisterSaleMembershipInput): Promise<string> {
    const params: Record<string, unknown> = {
      p_client_id: input.client_id,
      p_plan_id: input.plan_id,
    };
    if (input.start_date) params['p_start_date'] = input.start_date;

    const { data, error } = await this.client.rpc('register_sale_membership', params);
    if (error) throw error;
    return data as string;
  }

  // RPC cancel_sale: marca la venta como cancelada y aplica el efecto
  // colateral según type (revierte stock o desactiva la membresía asociada).
  async cancelSale(saleId: string): Promise<void> {
    const { error } = await this.client.rpc('cancel_sale', { p_sale_id: saleId });
    if (error) throw error;
  }
}
