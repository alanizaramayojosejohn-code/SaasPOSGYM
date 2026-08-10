import { inject, Injectable } from '@angular/core';
import {
  Client,
  ClientPurchaseSummary,
  ClientRegistrationsMonthly,
} from '../../models/client.model';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class ClientQueryService {
  private readonly client = inject(SupabaseService).client;

  // RLS filtra por business_id del caller automáticamente. Excluye borrados.
  async listClients(): Promise<Client[]> {
    const { data, error } = await this.client
      .from('clients')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Client[];
  }

  // ------------------------------------------------------------- Reportes

  async listPurchaseSummary(): Promise<ClientPurchaseSummary[]> {
    const { data, error } = await this.client
      .from('client_purchase_summary')
      .select('*')
      .order('total_spent', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ClientPurchaseSummary[];
  }

  async listRegistrationsMonthly(months = 12): Promise<ClientRegistrationsMonthly[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);

    const { data, error } = await this.client
      .from('client_registrations_monthly')
      .select('*')
      .gte('month', since.toISOString().slice(0, 10))
      .order('month', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ClientRegistrationsMonthly[];
  }
}
