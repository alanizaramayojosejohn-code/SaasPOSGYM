import { inject, Injectable } from '@angular/core';
import {
  PaymentMethod,
  SubscriptionOverview,
  SubscriptionPayment,
  SubscriptionStatus,
} from '../../models/plan.model';
import { SupabaseService } from '../supabase/supabase.service';

export interface RegisterSubscriptionPaymentInput {
  business_id: string;
  plan_code: string;
  amount: number;
  months: number;
  method: PaymentMethod;
  reference: string | null;
  paid_on: string;
  notes: string | null;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly client = inject(SupabaseService).client;

  /** Pagos del propio negocio. La RLS ya lo acota; el admin los ve para reclamar. */
  async listMyPayments(): Promise<SubscriptionPayment[]> {
    const { data, error } = await this.client
      .from('subscription_payments')
      .select('*')
      .order('paid_on', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SubscriptionPayment[];
  }

  // ------------------------------------------------------ Panel del SaaS

  async listOverview(): Promise<SubscriptionOverview[]> {
    const { data, error } = await this.client
      .from('subscription_overview')
      .select('*')
      .order('days_left', { ascending: true });
    if (error) throw error;
    return (data ?? []) as SubscriptionOverview[];
  }

  async listPaymentsFor(businessId: string): Promise<SubscriptionPayment[]> {
    const { data, error } = await this.client
      .from('subscription_payments')
      .select('*')
      .eq('business_id', businessId)
      .order('paid_on', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SubscriptionPayment[];
  }

  /**
   * Registra el cobro y extiende el período en la misma transacción. El cálculo
   * del nuevo vencimiento lo hace la base: si se resolviera acá, dos operadores
   * cobrando a la vez podrían pisarse el período.
   */
  async registerPayment(input: RegisterSubscriptionPaymentInput): Promise<string> {
    const { data, error } = await this.client.rpc('register_subscription_payment', {
      p_business_id: input.business_id,
      p_plan_code: input.plan_code,
      p_amount: input.amount,
      p_months: input.months,
      p_method: input.method,
      p_reference: input.reference,
      p_paid_on: input.paid_on,
      p_notes: input.notes,
    });
    if (error) throw error;
    return data as string;
  }

  /** Cambio manual de plan o estado, sin cobro (cortesías, suspensiones). */
  async setSubscription(
    businessId: string,
    changes: {
      plan_code?: string;
      status?: SubscriptionStatus;
      period_end?: string;
      trial_ends?: string;
    },
  ): Promise<void> {
    const { error } = await this.client.rpc('set_business_subscription', {
      p_business_id: businessId,
      p_plan_code: changes.plan_code ?? null,
      p_status: changes.status ?? null,
      p_period_end: changes.period_end ?? null,
      p_trial_ends: changes.trial_ends ?? null,
    });
    if (error) throw error;
  }
}
