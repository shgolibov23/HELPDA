import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { favoritesApi } from '@/api/endpoints';
import { useDialog } from '@/components/DialogProvider';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';
import type { Service } from '@/types';

/** Sevimliga qo'shish/olib tashlash. Yangi holatni (true/false) yoki bekor bo'lsa null qaytaradi. */
export function useFavoriteToggle() {
  const { user } = useAuth();
  const dialog = useDialog();
  const router = useRouter();

  return useCallback(
    async (service: Service): Promise<boolean | null> => {
      if (!user) {
        const go = await dialog.confirm({
          title: t('loginRequiredTitle'),
          message: t('loginRequiredMessage'),
          icon: 'heart-outline',
          tone: 'info',
          confirmText: t('login'),
        });
        if (go) router.push('/auth');
        return null;
      }
      try {
        const res = service.is_favorite ? await favoritesApi.remove(service.id) : await favoritesApi.add(service.id);
        return res.is_favorite;
      } catch (e) {
        await dialog.error(e);
        return null;
      }
    },
    [user, dialog, router]
  );
}
