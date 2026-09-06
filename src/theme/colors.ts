/**
 * Two palettes that mirror each other key-for-key so every component can read
 * `theme.<token>` without ever branching on the active scheme.
 */
export type Palette = {
  scheme: 'light' | 'dark';
  /** App background, behind everything. */
  background: string;
  /** Cards, sheets, list rows. */
  surface: string;
  /** A surface that needs to sit on top of another surface. */
  surfaceElevated: string;
  /** Hairlines and dividers. */
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentPressed: string;
  /** Text/icons drawn on top of `accent`. */
  onAccent: string;
  /** Tint behind an accent icon or chip. */
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  /** The paper-ish backdrop a scanned page sits on. */
  canvas: string;
  overlay: string;
};

export const lightPalette: Palette = {
  scheme: 'light',
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E3E8F0',
  text: '#0E1726',
  textMuted: '#5B6B85',
  textFaint: '#93A1B8',
  accent: '#0B78F0',
  accentPressed: '#0963C9',
  onAccent: '#FFFFFF',
  accentSoft: '#E4F0FE',
  danger: '#D93838',
  dangerSoft: '#FDEAEA',
  canvas: '#DCE1EA',
  overlay: 'rgba(14, 23, 38, 0.45)',
};

export const darkPalette: Palette = {
  scheme: 'dark',
  background: '#0A1220',
  surface: '#141E31',
  surfaceElevated: '#1C2942',
  border: '#26334A',
  text: '#F2F5FA',
  textMuted: '#9CACC6',
  textFaint: '#6B7C96',
  accent: '#3B95FF',
  accentPressed: '#2C7FE0',
  onAccent: '#04101F',
  accentSoft: '#152A45',
  danger: '#FF6B6B',
  dangerSoft: '#331A1D',
  canvas: '#060C16',
  overlay: 'rgba(2, 6, 14, 0.6)',
};
