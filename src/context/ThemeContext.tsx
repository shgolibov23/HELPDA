import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { setCurrentMode } from '@/theme';
import type { Mode } from '@/theme';

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'helpda_theme_pref';

type ThemeState = {
  pref: ThemePref;
  mode: Mode;
  ready: boolean;
  setPref: (p: ThemePref) => void;
  /** Mavzu sozlamalardan o'zgartirilgach, ilova qayta yuklanadi; sozlamalarga qaytish kerakmi? */
  consumeReopen: () => boolean;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [ready, setReady] = useState(false);
  const reopen = useRef(false);

  const mode: Mode = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  // Bolalar render bo'lishidan oldin joriy rejimni o'rnatamiz
  setCurrentMode(mode);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setPrefState(saved);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const setPref = useCallback(
    (next: ThemePref) => {
      const nextMode: Mode = next === 'system' ? (system === 'dark' ? 'dark' : 'light') : next;
      if (nextMode !== mode) reopen.current = true;
      setPrefState(next);
      SecureStore.setItemAsync(KEY, next).catch(() => undefined);
    },
    [system, mode]
  );

  const consumeReopen = useCallback(() => {
    const v = reopen.current;
    reopen.current = false;
    return v;
  }, []);

  const value = useMemo(() => ({ pref, mode, ready, setPref, consumeReopen }), [pref, mode, ready, setPref, consumeReopen]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme faqat ThemeProvider ichida ishlaydi');
  return ctx;
}
