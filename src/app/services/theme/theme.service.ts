import { Injectable, signal } from '@angular/core';
import {
  BusinessColors,
  DEFAULT_COLORS,
  DEFAULT_MODE,
  THEME_MODE_STORAGE_KEY,
  ThemeMode,
} from './theme.presets';

// Luminancia relativa WCAG — elige el texto (blanco/negro) que mejor
// contrasta sobre un color de negocio arbitrario elegido por el super_admin.
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastFg(bgHex: string): string {
  const bgLum = relativeLuminance(bgHex);
  const whiteContrast = (1 + 0.05) / (bgLum + 0.05);
  const blackContrast = (bgLum + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? '#FFFFFF' : '#0A0A0A';
}

// Aplica el tema al documento via data-attributes en <html>.
// Dos canales independientes:
//  · colors: los 2 colores del negocio asignado por el super_admin →
//    auth.service los carga al login y llama applyColors().
//  · mode (light/dark/system): preferencia del USUARIO en este navegador,
//    se persiste en localStorage. setMode() la cambia en runtime.
//
// El fondo (base/surface/elevated/foreground/border/...) NO se escribe desde
// acá: es CSS puro en styles.css (:root / :root[data-mode="dark"]), siempre
// monocromo. Solo --c-accent/-fg y --c-accent-2/-fg dependen de JS.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  // Colores del negocio actualmente aplicados. UI los lee para precargar el
  // picker en el form de business.
  readonly currentColors = signal<BusinessColors>(DEFAULT_COLORS);

  // Modo elegido por el usuario (puede ser 'system'). UI lo lee para el toggle.
  readonly currentMode = signal<ThemeMode>(DEFAULT_MODE);

  // Modo efectivamente aplicado (resuelto si currentMode = 'system').
  readonly resolvedMode = signal<'light' | 'dark'>('light');

  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    // Cargar mode persistido. En SSR window/localStorage no existen,
    // asi que protegemos con typeof checks.
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        this.currentMode.set(stored);
      }
    }
    this.applyModeResolution(this.currentMode());
  }

  // Llamado por auth.service.loadProfile() cuando vienen los colores del
  // business, y por reset() cuando no hay sesion. No toca el mode (separado).
  applyColors(colors: BusinessColors): void {
    this.currentColors.set(colors);
    this.writeColorVars();
  }

  // Toggle del usuario. Persiste en localStorage para que la proxima carga
  // arranque con la misma preferencia (sin esperar a que initialize aplique
  // nada — la lee el constructor).
  setMode(mode: ThemeMode): void {
    this.currentMode.set(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    }
    this.applyModeResolution(mode);
  }

  // Resetea los colores al default. NO toca el mode — la preferencia del
  // usuario sobrevive logout/login.
  reset(): void {
    this.applyColors(DEFAULT_COLORS);
  }

  private applyModeResolution(mode: ThemeMode): void {
    this.detachMediaListener();

    if (mode === 'system') {
      // Mientras este en 'system', escuchamos cambios del SO.
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaListener = (e) => this.setResolvedMode(e.matches ? 'dark' : 'light');
      this.mediaQuery.addEventListener('change', this.mediaListener);
      this.setResolvedMode(this.mediaQuery.matches ? 'dark' : 'light');
    } else {
      this.setResolvedMode(mode);
    }
  }

  private setResolvedMode(mode: 'light' | 'dark'): void {
    document.documentElement.dataset['mode'] = mode;
    this.resolvedMode.set(mode);
  }

  private writeColorVars(): void {
    const root = document.documentElement;
    const { color1, color2 } = this.currentColors();
    root.style.setProperty('--c-accent', color1);
    root.style.setProperty('--c-accent-fg', contrastFg(color1));
    root.style.setProperty('--c-accent-2', color2);
    root.style.setProperty('--c-accent-2-fg', contrastFg(color2));
  }

  private detachMediaListener(): void {
    if (this.mediaQuery && this.mediaListener) {
      this.mediaQuery.removeEventListener('change', this.mediaListener);
    }
    this.mediaQuery = null;
    this.mediaListener = null;
  }
}
