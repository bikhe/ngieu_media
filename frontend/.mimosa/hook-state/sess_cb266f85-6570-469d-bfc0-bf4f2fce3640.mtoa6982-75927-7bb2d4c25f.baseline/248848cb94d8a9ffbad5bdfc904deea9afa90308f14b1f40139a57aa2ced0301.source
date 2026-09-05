import { createContext } from 'react';

export type ThemePreset = 'gost-light' | 'gost-dark' | 'tg-light' | 'tg-dark' | 'custom';

export interface ThemeSettingsContextType {
  fontSize: number;
  setFontSize: (size: number) => void;
  themePreset: ThemePreset;
  setThemePreset: (preset: ThemePreset) => void;
  customColor: string;
  setCustomColor: (color: string) => void;
  hasCompletedSetup: boolean;
  completeSetup: () => void;
  openSetup: () => void;

  mode: 'light' | 'dark';
  toggleColorMode: () => void;
  brandName: string;
  logoUrl: string;
}

export const ThemeSettingsContext = createContext<ThemeSettingsContextType>({
  fontSize: 16,
  setFontSize: () => {},
  themePreset: 'gost-light',
  setThemePreset: () => {},
  customColor: '#005B9F',
  setCustomColor: () => {},
  hasCompletedSetup: false,
  completeSetup: () => {},
  openSetup: () => {},
  mode: 'light',
  toggleColorMode: () => {},
  brandName: 'Media Events',
  logoUrl: 'https://cdn-icons-png.flaticon.com/512/3003/3003310.png'
});
