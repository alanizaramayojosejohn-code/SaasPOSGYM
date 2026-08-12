import { inject, Injectable } from '@angular/core';
import { PaymentMethod } from '../../models/order.model';
import { SupabaseService } from '../supabase/supabase.service';

export interface RegisterProductItem {
  type: 'product';
  product_id: string;
  quantity: number;
}

export interface RegisterMembershipItem {
  type: 'membership';
  plan_id: string;
  start_date: string | null;
}

export type RegisterOrderItem = RegisterProductItem | RegisterMembershipItem;

export interface RegisterOrderInput {
  client_id: string | null;
  payment_method: PaymentMethod;
  items: RegisterOrderItem[];
  notes?: string | null;
}

// Kept for the membership form component output type.
export interface MembershipOrderInput {
  client_id: string;
  plan_id: string;
  start_date: string | null;
  payment_method: PaymentMethod;
  notes: string | null;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly client = inject(SupabaseService).client;

  // RPC register_order: crea orden + items de forma atómica.
  // Descuenta stock para productos y crea client_memberships para membresías.
  async registerOrder(input: RegisterOrderInput): Promise<string> {
    const { data, error } = await this.client.rpc('register_order', {
      p_client_id: input.client_id,
      p_payment_method: input.payment_method,
      p_items: input.items,
      p_notes: input.notes ?? null,
    });
    if (error) throw error;
    return data as string;
  }

  // RPC cancel_order: cancela la orden completa y revierte todos los efectos.
  async cancelOrder(orderId: string): Promise<void> {
    const { error } = await this.client.rpc('cancel_order', { p_order_id: orderId });
    if (error) throw error;
  }
}
