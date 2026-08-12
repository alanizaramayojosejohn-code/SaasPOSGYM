import { BusinessColors } from '../services/theme/theme.presets';

export type BusinessType = 'pos' | 'gym';

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  theme: BusinessColors;
  created_at: string;
}
