import { Injectable, signal } from '@angular/core';
import {
  BusinessTheme,
  DEFAULT_THEME,
  getPreset,
  THEME_PRESET_LIST,
  ThemeMode,
  ThemePreset,
  ThemeTokens,
} from './theme.presets';

// Aplica el tema al documento via data-attributes en <html>.
// styles.css define las variables CSS por combinacion preset+mode,
// y Tailwind v4 las consume via @theme. Cambiar el data-attribute
// re-pinta toda la app en un frame, sin reload.
//
// Bootstrap: app.config.ts llama applyFromAuth() despues de auth.initialize(),
// asi el tema correcto esta listo antes de que el router monte la primera ruta
// (evita el flash blanco durante el login).
@Injectable({ providedIn: 'root' })
export class ThemeService {
  // Tema actualmente aplicado. La UI puede leer esto para mostrar
  // pickers (ej: form de business resaltando el preset activo).
  readonly current = signal<BusinessTheme>(DEFAULT_THEME);

  // Modo efectivamente aplicado (resuelto si current.mode = 'system').
  // light/dark sale del preset; util para componentes que necesiten
  // saber el modo real (ej: cargar logo claro vs oscuro).
  readonly resolvedMode = signal<'light' | 'dark'>('light');

  // Listener de prefers-color-scheme. Solo activo cuando mode = 'system';
  // se cancela cuando el negocio elige light/dark explicito.
  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  apply(theme: BusinessTheme): void {
    this.current.set(theme);
    this.applyToDom(theme);
  }

  // Resetea al default (monochrome system). Util en logout o cuando
  // el usuario aun no tiene business asignado (super_admin viendo
  // login screen, por ejemplo).
  reset(): void {
    this.apply(DEFAULT_THEME);
  }

  private applyToDom(theme: BusinessTheme): void {
    const root = document.documentElement;
    const preset = getPreset(theme.preset);
    root.dataset['preset'] = preset.key;
    this.applyMode(theme.mode, preset);
  }

  private applyMode(mode: ThemeMode, preset: ThemePreset): void {
    this.detachMediaListener();

    if (mode === 'system') {
      // Usar la media query como fuente. Tambien suscribir a cambios:
      // si el usuario alterna OS dark/light mientras la app esta abierta,
      // re-aplicamos sin que tenga que recargar.
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaListener = (e) => this.setResolvedMode(e.matches ? 'dark' : 'light', preset);
      this.mediaQuery.addEventListener('change', this.mediaListener);
      this.setResolvedMode(this.mediaQuery.matches ? 'dark' : 'light', preset);
    } else {
      this.setResolvedMode(mode, preset);
    }
  }

  private setResolvedMode(mode: 'light' | 'dark', preset: ThemePreset): void {
    const root = document.documentElement;
    root.dataset['mode'] = mode;
    this.resolvedMode.set(mode);
    // Inyectamos los tokens como variables inline en :root.
    // Aunque styles.css ya los tiene declarados estaticamente por
    // [data-preset][data-mode], setearlos aca es defensivo: cubre el caso
    // de presets agregados en runtime (a futuro, custom themes por cliente).
    const tokens = mode === 'dark' ? preset.dark : preset.light;
    this.writeTokensToRoot(root, tokens);
  }

  private writeTokensToRoot(root: HTMLElement, tokens: ThemeTokens): void {
    root.style.setProperty('--c-base', tokens.base);
    root.style.setProperty('--c-surface', tokens.surface);
    root.style.setProperty('--c-elevated', tokens.elevated);
    root.style.setProperty('--c-input', tokens.input);
    root.style.setProperty('--c-muted', tokens.muted);
    root.style.setProperty('--c-foreground', tokens.foreground);
    root.style.setProperty('--c-foreground-muted', tokens.foregroundMuted);
    root.style.setProperty('--c-foreground-subtle', tokens.foregroundSubtle);
    root.style.setProperty('--c-foreground-faint', tokens.foregroundFaint);
    root.style.setProperty('--c-border', tokens.border);
    root.style.setProperty('--c-border-subtle', tokens.borderSubtle);
    root.style.setProperty('--c-primary', tokens.primary);
    root.style.setProperty('--c-primary-fg', tokens.primaryFg);
    root.style.setProperty('--c-accent', tokens.accent);
    root.style.setProperty('--c-accent-fg', tokens.accentFg);
    root.style.setProperty('--c-success', tokens.success);
    root.style.setProperty('--c-danger', tokens.danger);
    root.style.setProperty('--c-warning', tokens.warning);
  }

  private detachMediaListener(): void {
    if (this.mediaQuery && this.mediaListener) {
      this.mediaQuery.removeEventListener('change', this.mediaListener);
    }
    this.mediaQuery = null;
    this.mediaListener = null;
  }

  // Helper para el picker en el form de business (super_admin).
  // Devuelve la lista completa con metadata (label, description, tokens)
  // para renderizar previews.
  getPresets(): readonly ThemePreset[] {
    return THEME_PRESET_LIST;
  }
}
