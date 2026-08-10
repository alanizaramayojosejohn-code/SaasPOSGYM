import { inject, Injectable } from '@angular/core';
import { Client } from '../../models/client.model';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface CreateClientInput {
  ci: string;
  nit: string | null;
  business_name: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  birth_date: string | null;
  notes: string | null;
  is_active: boolean;
}

export type UpdateClientInput = CreateClientInput;

// Los índices únicos parciales de 20260810020000 devuelven 23505.
function translateClientError(err: unknown): unknown {
  if (!err || typeof err !== 'object') return err;
  if ((err as { code?: unknown }).code !== '23505') return err;
  const message = String((err as { message?: unknown }).message ?? '');
  if (message.includes('idx_clients_ci_unique')) {
    return new Error('Ya existe un cliente con ese CI en este negocio.');
  }
  if (message.includes('idx_clients_nit_unique')) {
    return new Error('Ya existe un cliente con ese NIT en este negocio.');
  }
  return err;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly client = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  private toRow(input: CreateClientInput) {
    return {
      ci: input.ci,
      nit: input.nit,
      business_name: input.business_name,
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      birth_date: input.birth_date,
      notes: input.notes,
      is_active: input.is_active,
    };
  }

  async createClient(input: CreateClientInput): Promise<Client> {
    const businessId = this.auth.businessId();
    if (!businessId) throw new Error('Tu cuenta no tiene un negocio asignado.');

    const { data, error } = await this.client
      .from('clients')
      .insert({ business_id: businessId, ...this.toRow(input) })
      .select('*')
      .single();
    if (error) throw translateClientError(error);
    return data as Client;
  }

  async updateClient(id: string, input: UpdateClientInput): Promise<Client> {
    const { data, error } = await this.client
      .from('clients')
      .update(this.toRow(input))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw translateClientError(error);
    return data as Client;
  }

  async setClientActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await this.client
      .from('clients')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw error;
  }

  // Soft delete. El borrado real fallaba en cuanto el cliente tenía una venta
  // o una membresía; además el histórico de facturación debe conservarse.
  async softDeleteClient(id: string): Promise<void> {
    const { error } = await this.client
      .from('clients')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id);
    if (error) throw error;
  }
}
