// Presets de tema disponibles para los negocios.
// El super_admin elige uno al crear/editar el negocio.
// Cada preset define ambos modos (light + dark) — el negocio elige el modo aparte.
//
// Los valores aquí son la fuente de verdad. La DB solo guarda la *clave* del preset
// y el modo seleccionado. Si agregas o sacas un preset, hay que migrar negocios
// que lo tuvieran asignado (o caer al default por seguridad — ver getPreset()).

export type ThemePresetKey =
  | 'monochrome'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'plum'
  | 'graphite';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface BusinessTheme {
  preset: ThemePresetKey;
  mode: ThemeMode;
}

export const DEFAULT_THEME: BusinessTheme = {
  preset: 'monochrome',
  mode: 'system',
};

// Tokens semánticos. Mantener este shape sincronizado con styles.css.
// Los nombres mapean a utilities Tailwind (bg-base, text-foreground, etc.).
export interface ThemeTokens {
  // Fondos
  base: string;        // fondo de la página
  surface: string;     // glass cards (translucent)
  elevated: string;    // modales, popups
  input: string;       // fondo de inputs
  muted: string;       // chips/pills sutiles

  // Texto
  foreground: string;
  foregroundMuted: string;
  foregroundSubtle: string;
  foregroundFaint: string;

  // Bordes
  border: string;
  borderSubtle: string;

  // Marca
  primary: string;
  primaryFg: string;   // texto sobre primary
  accent: string;
  accentFg: string;

  // Semánticos
  success: string;
  danger: string;
  warning: string;
}

export interface ThemePreset {
  key: ThemePresetKey;
  label: string;
  description: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}

// Helper para construir paletas con menos repetición.
// El preset monochrome es el diseño base B&W glass del pencil.
const monochrome: ThemePreset = {
  key: 'monochrome',
  label: 'Monocromo',
  description: 'Blanco y negro · diseño base del sistema',
  light: {
    base: '#FAFAFA',
    surface: 'rgba(255, 255, 255, 0.8)',
    elevated: 'rgba(255, 255, 255, 0.92)',
    input: 'rgba(10, 10, 10, 0.04)',
    muted: 'rgba(10, 10, 10, 0.06)',
    foreground: '#0A0A0A',
    foregroundMuted: 'rgba(10, 10, 10, 0.7)',
    foregroundSubtle: 'rgba(10, 10, 10, 0.5)',
    foregroundFaint: 'rgba(10, 10, 10, 0.4)',
    border: 'rgba(0, 0, 0, 0.12)',
    borderSubtle: 'rgba(0, 0, 0, 0.08)',
    primary: '#0A0A0A',
    primaryFg: '#FFFFFF',
    accent: '#FFFFFF',
    accentFg: '#0A0A0A',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
  },
  dark: {
    base: '#050505',
    surface: 'rgba(255, 255, 255, 0.04)',
    elevated: 'rgba(255, 255, 255, 0.06)',
    input: 'rgba(255, 255, 255, 0.04)',
    muted: 'rgba(255, 255, 255, 0.06)',
    foreground: '#FFFFFF',
    foregroundMuted: 'rgba(255, 255, 255, 0.7)',
    foregroundSubtle: 'rgba(255, 255, 255, 0.5)',
    foregroundFaint: 'rgba(255, 255, 255, 0.4)',
    border: 'rgba(255, 255, 255, 0.14)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    primary: '#FFFFFF',
    primaryFg: '#0A0A0A',
    accent: '#0A0A0A',
    accentFg: '#FFFFFF',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
  },
};

const ocean: ThemePreset = {
  key: 'ocean',
  label: 'Océano',
  description: 'Azules profundos · estilo financiero',
  light: {
    base: '#F0F7FB',
    surface: 'rgba(255, 255, 255, 0.85)',
    elevated: 'rgba(255, 255, 255, 0.95)',
    input: 'rgba(15, 76, 117, 0.05)',
    muted: 'rgba(15, 76, 117, 0.08)',
    foreground: '#0F1F2E',
    foregroundMuted: 'rgba(15, 31, 46, 0.7)',
    foregroundSubtle: 'rgba(15, 31, 46, 0.5)',
    foregroundFaint: 'rgba(15, 31, 46, 0.4)',
    border: 'rgba(15, 76, 117, 0.18)',
    borderSubtle: 'rgba(15, 76, 117, 0.1)',
    primary: '#0F4C75',
    primaryFg: '#FFFFFF',
    accent: '#3282B8',
    accentFg: '#FFFFFF',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
  },
  dark: {
    base: '#061829',
    surface: 'rgba(50, 130, 184, 0.08)',
    elevated: 'rgba(50, 130, 184, 0.12)',
    input: 'rgba(187, 225, 250, 0.06)',
    muted: 'rgba(187, 225, 250, 0.08)',
    foreground: '#F1F5F9',
    foregroundMuted: 'rgba(241, 245, 249, 0.72)',
    foregroundSubtle: 'rgba(241, 245, 249, 0.5)',
    foregroundFaint: 'rgba(241, 245, 249, 0.4)',
    border: 'rgba(187, 225, 250, 0.16)',
    borderSubtle: 'rgba(187, 225, 250, 0.1)',
    primary: '#3282B8',
    primaryFg: '#FFFFFF',
    accent: '#BBE1FA',
    accentFg: '#06283D',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
  },
};

const forest: ThemePreset = {
  key: 'forest',
  label: 'Bosque',
  description: 'Verdes naturales · estilo wellness',
  light: {
    base: '#F2F8F2',
    surface: 'rgba(255, 255, 255, 0.85)',
    elevated: 'rgba(255, 255, 255, 0.95)',
    input: 'rgba(15, 81, 50, 0.05)',
    muted: 'rgba(15, 81, 50, 0.08)',
    foreground: '#14241A',
    foregroundMuted: 'rgba(20, 36, 26, 0.7)',
    foregroundSubtle: 'rgba(20, 36, 26, 0.5)',
    foregroundFaint: 'rgba(20, 36, 26, 0.4)',
    border: 'rgba(15, 81, 50, 0.18)',
    borderSubtle: 'rgba(15, 81, 50, 0.1)',
    primary: '#0F5132',
    primaryFg: '#FFFFFF',
    accent: '#57A773',
    accentFg: '#FFFFFF',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
  },
  dark: {
    base: '#051F11',
    surface: 'rgba(87, 167, 115, 0.08)',
    elevated: 'rgba(87, 167, 115, 0.12)',
    input: 'rgba(167, 201, 87, 0.06)',
    muted: 'rgba(167, 201, 87, 0.08)',
    foreground: '#F0FDF4',
    foregroundMuted: 'rgba(240, 253, 244, 0.72)',
    foregroundSubtle: 'rgba(240, 253, 244, 0.5)',
    foregroundFaint: 'rgba(240, 253, 244, 0.4)',
    border: 'rgba(167, 201, 87, 0.16)',
    borderSubtle: 'rgba(167, 201, 87, 0.1)',
    primary: '#57A773',
    primaryFg: '#0F2418',
    accent: '#A7C957',
    accentFg: '#0F2418',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
  },
};

const sunset: ThemePreset = {
  key: 'sunset',
  label: 'Atardecer',
  description: 'Cálidos terracota · estilo boutique',
  light: {
    base: '#FDF6F0',
    surface: 'rgba(255, 255, 255, 0.85)',
    elevated: 'rgba(255, 255, 255, 0.95)',
    input: 'rgba(124, 45, 18, 0.05)',
    muted: 'rgba(124, 45, 18, 0.08)',
    foreground: '#2C1810',
    foregroundMuted: 'rgba(44, 24, 16, 0.7)',
    foregroundSubtle: 'rgba(44, 24, 16, 0.5)',
    foregroundFaint: 'rgba(44, 24, 16, 0.4)',
    border: 'rgba(124, 45, 18, 0.18)',
    borderSubtle: 'rgba(124, 45, 18, 0.1)',
    primary: '#7C2D12',
    primaryFg: '#FFFFFF',
    accent: '#F97316',
    accentFg: '#FFFFFF',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
  },
  dark: {
    base: '#1A0F08',
    surface: 'rgba(249, 115, 22, 0.08)',
    elevated: 'rgba(249, 115, 22, 0.12)',
    input: 'rgba(254, 215, 170, 0.06)',
    muted: 'rgba(254, 215, 170, 0.08)',
    foreground: '#FED7AA',
    foregroundMuted: 'rgba(254, 215, 170, 0.72)',
    foregroundSubtle: 'rgba(254, 215, 170, 0.5)',
    foregroundFaint: 'rgba(254, 215, 170, 0.4)',
    border: 'rgba(254, 215, 170, 0.16)',
    borderSubtle: 'rgba(254, 215, 170, 0.1)',
    primary: '#F97316',
    primaryFg: '#1A0F08',
    accent: '#FBBF24',
    accentFg: '#1A0F08',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
  },
};

const plum: ThemePreset = {
  key: 'plum',
  label: 'Ciruela',
  description: 'Violetas modernos · estilo tech',
  light: {
    base: '#FAF5FB',
    surface: 'rgba(255, 255, 255, 0.85)',
    elevated: 'rgba(255, 255, 255, 0.95)',
    input: 'rgba(88, 28, 135, 0.05)',
    muted: 'rgba(88, 28, 135, 0.08)',
    foreground: '#1E0F2E',
    foregroundMuted: 'rgba(30, 15, 46, 0.7)',
    foregroundSubtle: 'rgba(30, 15, 46, 0.5)',
    foregroundFaint: 'rgba(30, 15, 46, 0.4)',
    border: 'rgba(88, 28, 135, 0.18)',
    borderSubtle: 'rgba(88, 28, 135, 0.1)',
    primary: '#581C87',
    primaryFg: '#FFFFFF',
    accent: '#A855F7',
    accentFg: '#FFFFFF',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
  },
  dark: {
    base: '#0F0719',
    surface: 'rgba(168, 85, 247, 0.08)',
    elevated: 'rgba(168, 85, 247, 0.12)',
    input: 'rgba(243, 232, 255, 0.06)',
    muted: 'rgba(243, 232, 255, 0.08)',
    foreground: '#F3E8FF',
    foregroundMuted: 'rgba(243, 232, 255, 0.72)',
    foregroundSubtle: 'rgba(243, 232, 255, 0.5)',
    foregroundFaint: 'rgba(243, 232, 255, 0.4)',
    border: 'rgba(243, 232, 255, 0.16)',
    borderSubtle: 'rgba(243, 232, 255, 0.1)',
    primary: '#A855F7',
    primaryFg: '#FFFFFF',
    accent: '#C084FC',
    accentFg: '#0F0719',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
  },
};

const graphite: ThemePreset = {
  key: 'graphite',
  label: 'Grafito',
  description: 'Azul corporativo · estilo dashboard',
  light: {
    base: '#F8FAFC',
    surface: 'rgba(255, 255, 255, 0.85)',
    elevated: 'rgba(255, 255, 255, 0.95)',
    input: 'rgba(31, 41, 55, 0.05)',
    muted: 'rgba(31, 41, 55, 0.08)',
    foreground: '#0F172A',
    foregroundMuted: 'rgba(15, 23, 42, 0.7)',
    foregroundSubtle: 'rgba(15, 23, 42, 0.5)',
    foregroundFaint: 'rgba(15, 23, 42, 0.4)',
    border: 'rgba(31, 41, 55, 0.18)',
    borderSubtle: 'rgba(31, 41, 55, 0.1)',
    primary: '#1F2937',
    primaryFg: '#FFFFFF',
    accent: '#3B82F6',
    accentFg: '#FFFFFF',
    success: '#059669',
    danger: '#DC2626',
    warning: '#D97706',
  },
  dark: {
    base: '#0B0F19',
    surface: 'rgba(59, 130, 246, 0.08)',
    elevated: 'rgba(59, 130, 246, 0.12)',
    input: 'rgba(229, 231, 235, 0.06)',
    muted: 'rgba(229, 231, 235, 0.08)',
    foreground: '#E5E7EB',
    foregroundMuted: 'rgba(229, 231, 235, 0.72)',
    foregroundSubtle: 'rgba(229, 231, 235, 0.5)',
    foregroundFaint: 'rgba(229, 231, 235, 0.4)',
    border: 'rgba(229, 231, 235, 0.16)',
    borderSubtle: 'rgba(229, 231, 235, 0.1)',
    primary: '#3B82F6',
    primaryFg: '#FFFFFF',
    accent: '#60A5FA',
    accentFg: '#0B0F19',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
  },
};

export const THEME_PRESETS: Record<ThemePresetKey, ThemePreset> = {
  monochrome,
  ocean,
  forest,
  sunset,
  plum,
  graphite,
};

export const THEME_PRESET_LIST: ThemePreset[] = Object.values(THEME_PRESETS);

// Resuelve un preset por clave. Si la clave es invalida (ej: alguien
// borro un preset y un negocio aun lo tenia asignado), cae a monochrome
// para no romper la UI.
export function getPreset(key: string | null | undefined): ThemePreset {
  if (key && key in THEME_PRESETS) return THEME_PRESETS[key as ThemePresetKey];
  return THEME_PRESETS.monochrome;
}
