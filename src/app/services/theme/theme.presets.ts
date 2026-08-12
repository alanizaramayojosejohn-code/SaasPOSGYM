// Fondo: siempre monocromo (negro/blanco segun modo), definido en CSS puro
// (ver styles.css :root / :root[data-mode="dark"]). No hay presets de fondo
// seleccionables — la unica personalizacion por negocio son sus 2 colores.

// Mode es preferencia GLOBAL del usuario, no del negocio: lo guarda
// theme.service en localStorage. Tres opciones; 'system' sigue prefers-color-scheme.
export type ThemeMode = 'light' | 'dark' | 'system';

export const DEFAULT_MODE: ThemeMode = 'system';

// Clave localStorage. Cambiar este string es breaking: descarta la
// preferencia que tuvieran los usuarios.
export const THEME_MODE_STORAGE_KEY = 'saasgym.theme.mode';

// Los 2 colores que el super_admin elige al crear/editar un negocio.
// Afectan botones primarios, iconos de listados, graficas y links —
// nunca fondo/cards, que quedan fijos en monocromo.
export interface BusinessColors {
  color1: string;
  color2: string;
}

export const DEFAULT_COLORS: BusinessColors = {
  color1: '#0284c7',
  color2: '#7c3aed',
};

// Paletas rápidas: combos curados para llenar color1/color2 de un click en
// el form de negocio. Es un atajo, no un catálogo — el super_admin puede
// tocarlas después con el picker manual sin restricción.
export const QUICK_PALETTES: readonly { name: string; color1: string; color2: string }[] = [
  { name: 'Cielo', color1: '#0284c7', color2: '#7c3aed' },
  { name: 'Océano', color1: '#0f4c75', color2: '#3282b8' },
  { name: 'Bosque', color1: '#0f5132', color2: '#57a773' },
  { name: 'Atardecer', color1: '#c2410c', color2: '#f59e0b' },
  { name: 'Ciruela', color1: '#7c3aed', color2: '#c084fc' },
  { name: 'Grafito', color1: '#1f2937', color2: '#3b82f6' },
];
