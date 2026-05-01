import { inject, Injectable } from '@angular/core';
import { UserRole } from '../../models/profile.model';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface CreateUserForBusinessInput {
  email: string;
  password: string;
  name: string;
  ci: string;
  role: Extract<UserRole, 'admin' | 'caja'>;
  business_id?: string; // solo super_admin lo usa
}

export interface UpdateProfileInput {
  name: string;
  ci: string;
  role: Extract<UserRole, 'admin' | 'caja'>;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly client = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  // Edge Function create-business-user: crea auth.user + profile en una sola llamada.
  // Para admin: business_id = el del caller (el server lo resuelve, ignora el del body).
  // Para super_admin: requiere business_id explícito.
  async createUserForBusiness(input: CreateUserForBusinessInput): Promise<string> {
    const { data, error } = await this.client.functions.invoke('create-business-user', {
      body: {
        email: input.email,
        password: input.password,
        name: input.name,
        ci: input.ci,
        role: input.role,
        business_id: input.business_id,
      },
    });
    if (error) {
      // FunctionsHttpError trae el body de error en .context — lo extraemos para
      // mostrar el mensaje real ("La password debe tener al menos…", etc.).
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const payload = await ctx.json();
          if (payload?.error) throw new Error(payload.error);
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message) throw parseErr;
        }
      }
      throw error;
    }
    return (data as { user_id: string }).user_id;
  }

  // Update solo de campos editables (name, ci, role). business_id e id no se tocan.
  // RLS profiles_admin_same_business cubre el chequeo de tenant.
  async updateProfile(id: string, input: UpdateProfileInput): Promise<void> {
    const { error } = await this.client
      .from('profiles')
      .update({ name: input.name, ci: input.ci, role: input.role })
      .eq('id', id);
    if (error) throw error;
  }

  // Borra el profile. El auth.user queda intacto pero sin profile asignado:
  // AuthService.loadProfile lo cierra en el próximo login (patrón invite-only).
  async deleteProfile(id: string): Promise<void> {
    const { error } = await this.client
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
