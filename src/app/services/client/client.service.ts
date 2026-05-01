import { inject, Injectable } from '@angular/core';
import { Client } from '../../models/client.model';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface CreateClientInput {
  ci: string;
  name: string;
  phone: string | null;
}

export type UpdateClientInput = CreateClientInput;

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly client = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  async createClient(input: CreateClientInput): Promise<Client> {
    const businessId = this.auth.businessId();
    if (!businessId) throw new Error('Tu cuenta no tiene un negocio asignado.');

    const { data, error } = await this.client
      .from('clients')
      .insert({
        business_id: businessId,
        ci: input.ci,
        name: input.name,
        phone: input.phone,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as Client;
  }

  async updateClient(id: string, input: UpdateClientInput): Promise<Client> {
    const { data, error } = await this.client
      .from('clients')
      .update({ ci: input.ci, name: input.name, phone: input.phone })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as Client;
  }

  async deleteClient(id: string): Promise<void> {
    const { error } = await this.client.from('clients').delete().eq('id', id);
    if (error) throw error;
  }
}
