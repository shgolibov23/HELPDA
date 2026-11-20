import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ApiError, setAuthToken, setUnauthorizedHandler } from '@/api/client';
import { authApi, marketplaceApi } from '@/api/endpoints';
import { useDialog } from '@/components/DialogProvider';
import { t } from '@/i18n';
import type { User } from '@/types';

const TOKEN_KEY = 'helpda_access_token';
const PUSH_TOKEN_KEY = 'helpda_push_token';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  register: (data: { full_name: string; phone: string; email?: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const dialog = useDialog();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(async (unregisterPush = true) => {
    if (unregisterPush) {
      try {
        const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
        if (pushToken) await marketplaceApi.unregisterPushToken(pushToken);
      } catch (error) {
        console.warn('Push tokenni akkauntdan uzib bo‘lmadi:', error);
      }
    }
    setAuthToken(null);
    setUser(null);
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    } catch {
      // saqlash bilan bog'liq xato foydalanuvchiga ko'rsatilmaydi
    }
  }, []);

  // Ilova ochilganda saqlangan tokenni tekshirish
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          setAuthToken(saved);
          const me = await authApi.me();
          setUser(me);
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await clearSession();
        }
        // Tarmoq xatosida token saqlanib qoladi: keyingi safar qayta uriniladi
      } finally {
        setLoading(false);
      }
    })();
  }, [clearSession]);

  // Token muddati tugasa (401) avtomatik chiqarish
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!user) return;
      clearSession(false).then(() =>
        dialog.notify({
          type: 'warning',
          title: t('sessionExpiredTitle'),
          message: t('sessionExpiredMessage'),
        })
      );
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, dialog, user]);

  const finishAuth = useCallback(async (token: string, u: User) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(u);
    return u;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (phone, password) => {
        const res = await authApi.login(phone, password);
        return finishAuth(res.access_token, res.user);
      },
      register: async (data) => {
        const res = await authApi.register(data);
        return finishAuth(res.access_token, res.user);
      },
      logout: clearSession,
      refreshUser: async () => {
        try {
          setUser(await authApi.me());
        } catch {
          // jimgina: asosiy oqimga xalaqit bermaydi
        }
      },
      setUser,
    }),
    [user, loading, finishAuth, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth faqat AuthProvider ichida ishlaydi');
  return ctx;
}
