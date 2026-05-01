import { inject, Injectable } from '@angular/core';
import { BusinessType } from '../../models/business.model';
import { SupabaseService } from '../supabase/supabase.service';
import { BusinessTheme } from '../theme/theme.presets';

export interface CreateBusinessWithAdminInput {
  businessName: string;
  businessType: BusinessType;
  adminUserId: string;
  adminName: string;
  adminCi: string;
  services: string[];
  theme?: BusinessTheme;
}

export interface UpdateBusinessInput {
  name: string;
  type: BusinessType;
  theme?: BusinessTheme;
}

@Injectable({ providedIn: 'root' })
export class BusinessService {
  private readonly client = inject(SupabaseService).client;

  // RPC create_business_with_admin: crea negocio + profile del admin + servicios
  // en una sola transacción. Devuelve el business_id creado.
  // Si se pasa theme, se aplica con un update inmediato (la RPC actual no lo
  // recibe — evita migrar la firma del RPC). El default 'monochrome system'
  // queda si no se pasa nada.
  async createBusinessWithAdmin(input: CreateBusinessWithAdminInput): Promise<string> {
    const { data, error } = await this.client.rpc('create_business_with_admin', {
      p_business_name: input.businessName,
      p_business_type: input.businessType,
      p_admin_user_id: input.adminUserId,
      p_admin_name: input.adminName,
      p_admin_ci: input.adminCi,
      p_services: input.services,
    });
    if (error) throw error;
    const businessId = data as string;

    if (input.theme) {
      await this.updateTheme(businessId, input.theme);
    }
    return businessId;
  }

  async updateBusiness(id: string, input: UpdateBusinessInput): Promise<void> {
    const update: Record<string, unknown> = { name: input.name, type: input.type };
    if (input.theme) update['theme'] = input.theme;

    const { error } = await this.client
      .from('businesses')
      .update(update)
      .eq('id', id);
    if (error) throw error;
  }

  // Actualizacion aislada del tema. La usamos tanto post-creacion (cuando
  // el super_admin pico paleta en el form de alta) como desde el toggle
  // de apariencia mas adelante. RLS ya restringe businesses al super_admin.
  async updateTheme(id: string, theme: BusinessTheme): Promise<void> {
    const { error } = await this.client
      .from('businesses')
      .update({ theme })
      .eq('id', id);
    if (error) throw error;
  }

  // Hard delete con cascade: borra TODO lo asociado al business
  // (profiles, clients, products, sales, plans, memberships, attendance...).
  // El UI debe pedir confirmación explícita antes de invocarlo.
  async deleteBusiness(id: string): Promise<void> {
    const { error } = await this.client
      .from('businesses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
