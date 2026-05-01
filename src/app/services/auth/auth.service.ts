import { computed, inject, Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { BusinessType } from '../../models/business.model';
import { Profile, UserRole } from '../../models/profile.model';
import { SupabaseService } from '../supabase/supabase.service';
import { BusinessTheme, DEFAULT_THEME } from '../theme/theme.presets';
import { ThemeService } from '../theme/theme.service';

interface ProfileWithBusiness extends Profile {
  businesses: { type: BusinessType; theme: BusinessTheme | null } | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = inject(SupabaseService).client;
  private readonly theme = inject(ThemeService);

  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly businessType = signal<BusinessType | null>(null);
  // Tema actual del negocio. Lo expone aqui (en lugar de meterlo en theme.service)
  // porque el theme se deriva del profile y se actualiza con el mismo loadProfile().
  readonly businessTheme = signal<BusinessTheme | null>(null);
  // Set cuando una sesión válida no tiene profile asignado.
  // Lo lee el login para mostrar "Tu cuenta no está autorizada".
  readonly unauthorizedEmail = signal<string | null>(null);

  readonly role = computed<UserRole | null>(() => this.profile()?.role ?? null);
  readonly businessId = computed<string | null>(() => this.profile()?.business_id ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  // Llamado por APP_INITIALIZER. Espera a que sesión + profile carguen
  // antes de que el router monte cualquier ruta. También captura el callback
  // de OAuth porque supabase-js procesa el hash de la URL en getSession().
  async initialize(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    this.session.set(data.session);
    if (data.session) await this.loadProfile(data.session.user.id);

    this.client.auth.onAuthStateChange(async (_event, session) => {
      this.session.set(session);
      if (session) await this.loadProfile(session.user.id);
      else {
        this.profile.set(null);
        this.businessType.set(null);
        this.businessTheme.set(null);
        this.theme.reset();
      }
    });
  }

  async login(email: string, password: string): Promise<void> {
    this.unauthorizedEmail.set(null);
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('No se pudo iniciar sesión');
    this.session.set(data.session);
    await this.loadProfile(data.session.user.id);
    if (this.profile() === null) {
      throw new Error('Tu cuenta no está autorizada en SaasGym. Contacta al administrador.');
    }
  }

  // No retorna: redirige el navegador a Google. Vuelve a /login con el hash
  // OAuth, que supabase-js procesa automáticamente al cargar la app.
  async loginWithGoogle(): Promise<void> {
    this.unauthorizedEmail.set(null);
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw error;
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
    this.businessType.set(null);
    this.businessTheme.set(null);
    this.unauthorizedEmail.set(null);
    this.theme.reset();
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*, businesses(type, theme)')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error cargando profile', error);
      this.profile.set(null);
      this.businessType.set(null);
      this.businessTheme.set(null);
      this.theme.reset();
      return;
    }

    if (!data) {
      // Sesión válida pero sin profile (ej: Google OAuth de un email
      // que el super_admin nunca dio de alta). Cierra sesión para no
      // dejar token huérfano y marca el email como no autorizado.
      const email = this.session()?.user.email ?? null;
      this.unauthorizedEmail.set(email);
      await this.client.auth.signOut();
      this.session.set(null);
      this.profile.set(null);
      this.businessType.set(null);
      this.businessTheme.set(null);
      this.theme.reset();
      return;
    }

    const { businesses, ...profile } = data as ProfileWithBusiness;
    this.profile.set(profile);
    this.businessType.set(businesses?.type ?? null);

    // Aplica el tema apenas tenemos profile cargado. super_admin no tiene
    // business asignado (businesses === null) → default monochrome.
    const businessTheme = businesses?.theme ?? DEFAULT_THEME;
    this.businessTheme.set(businessTheme);
    this.theme.apply(businessTheme);
  }
}
