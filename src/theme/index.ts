import { StyleSheet } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

export type Mode = 'light' | 'dark';

// ---------- Ranglar ----------
// `black` — tanlangan chip / "dark" tugma foni. Qorong'i rejimda u yorqin yashilga aylanadi.
const light = {
  black: '#08140F',
  ink: '#0E1A14',
  green: '#0F8A5C',
  greenMid: '#0A6B47',
  greenDark: '#06301F',
  greenSoft: '#E2F2E9',
  bg: '#F2F6F4',
  surface: '#FFFFFF',
  border: '#DEE8E3',
  text: '#08140F',
  muted: '#5C6D65',
  placeholder: '#93A39B',
  danger: '#D64545',
  dangerSoft: '#FCEBEB',
  warning: '#A86B00',
  warningSoft: '#FFF3D1',
  info: '#2B6CB0',
  infoSoft: '#E8F1FB',
  neutralSoft: '#E9EFEC',
  glass: 'rgba(255,255,255,0.94)',
  white: '#FFFFFF',
  overlay: 'rgba(4, 14, 9, 0.6)',
};

export type Palette = typeof light;

const dark: Palette = {
  black: '#1B8F62',
  ink: '#EAF4EF',
  green: '#2BC283',
  greenMid: '#3FD598',
  greenDark: '#0B3A28',
  greenSoft: '#12261D',
  bg: '#07100C',
  surface: '#0E1813',
  border: '#1C2D25',
  text: '#EAF4EF',
  muted: '#8DA399',
  placeholder: '#5C7268',
  danger: '#F26B6B',
  dangerSoft: '#2A1414',
  warning: '#E8B04A',
  warningSoft: '#2B2210',
  info: '#6AA6E6',
  infoSoft: '#12202F',
  neutralSoft: '#16231D',
  glass: 'rgba(14,24,19,0.9)',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.72)',
};

const palettes: Record<Mode, Palette> = { light, dark };

let currentMode: Mode = 'light';
export function setCurrentMode(mode: Mode) {
  currentMode = mode;
}
export function getCurrentMode(): Mode {
  return currentMode;
}

/** Har o'qilganda joriy rejimdagi qiymatni qaytaradigan obyekt. */
function live<T extends object>(source: (mode: Mode) => T): T {
  const out = {} as T;
  for (const key of Object.keys(source('light')) as (keyof T)[]) {
    Object.defineProperty(out, key, { enumerable: true, get: () => source(currentMode)[key] });
  }
  return out;
}

export const colors: Palette = live((m) => palettes[m]);

export const gradients = live((m) =>
  m === 'dark'
    ? {
        primary: ['#0D5F40', '#1FA971'] as const,
        dark: ['#06150E', '#0E4230'] as const,
        soft: ['#12261D', '#07100C'] as const,
      }
    : {
        primary: ['#06301F', '#0F8A5C'] as const,
        dark: ['#04281A', '#0B6B47'] as const,
        soft: ['#E2F2E9', '#F2F6F4'] as const,
      }
);

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const shadow = live((m): Record<'card' | 'float', ViewStyle> => ({
  card: {
    shadowColor: '#000000',
    shadowOpacity: m === 'dark' ? 0.35 : 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: m === 'dark' ? 0 : 2,
  },
  float: {
    shadowColor: m === 'dark' ? '#000000' : '#06301F',
    shadowOpacity: m === 'dark' ? 0.5 : 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: m === 'dark' ? 0 : 8,
  },
}));

type TypoKey = 'h1' | 'h2' | 'h3' | 'body' | 'bodyBold' | 'small' | 'caption' | 'label';

export const typo = live((m): Record<TypoKey, TextStyle> => {
  const c = palettes[m];
  return {
    h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: c.text },
    h2: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: c.text },
    h3: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, color: c.text },
    body: { fontSize: 15, fontWeight: '400', lineHeight: 22, color: c.text },
    bodyBold: { fontSize: 15, fontWeight: '700', color: c.text },
    small: { fontSize: 13, fontWeight: '500', color: c.muted },
    caption: { fontSize: 12, fontWeight: '600', color: c.muted },
    label: { fontSize: 13, fontWeight: '700', color: c.text },
  };
});

/**
 * StyleSheet.create o'rniga: uslublar har bir rejim uchun bir marta yaratiladi
 * va rejim o'zgarganda avtomatik yangisi olinadi.
 */
export function makeStyles<T extends Record<keyof T, ViewStyle | TextStyle | ImageStyle>>(factory: () => T): T {
  const cache: Partial<Record<Mode, T>> = {};
  return new Proxy({} as T, {
    get(_target, key) {
      const sheet = cache[currentMode] ?? (cache[currentMode] = StyleSheet.create(factory()) as T);
      return sheet[key as keyof T];
    },
  });
}
