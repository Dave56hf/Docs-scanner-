import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkPalette, lightPalette, type Palette } from './colors';
import { useSettings, type ThemePreference } from '@/store/settings';

export { space, radius, font } from './tokens';
export type { Palette } from './colors';

const ThemeContext = createContext<Palette>(lightPalette);

function resolve(preference: ThemePreference, system: 'light' | 'dark'): Palette {
  const scheme = preference === 'system' ? system : preference;
  return scheme === 'dark' ? darkPalette : lightPalette;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSettings((s) => s.theme);
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = useMemo(() => resolve(preference, system), [preference, system]);

  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Palette {
  return useContext(ThemeContext);
}
