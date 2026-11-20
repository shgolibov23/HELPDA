import { router } from 'expo-router';
import { FlatList, View } from 'react-native';

import { favoritesApi } from '@/api/endpoints';
import { ScreenHeader, Screen } from '@/components/Screen';
import { ServiceCard } from '@/components/ServiceCard';
import { EmptyState, ErrorState, GuestPrompt, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useFetch } from '@/hooks/useFetch';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { t } from '@/i18n';
import type { Service } from '@/types';

export default function FavoritesScreen() {
  const { user } = useAuth();
  const toggleFavorite = useFavoriteToggle();
  const { data, loading, error, reload, silentReload, setData } = useFetch(() => favoritesApi.list(), [user?.id], !!user);
  useRefetchOnFocus(() => user && silentReload());

  const remove = async (s: Service) => {
    const value = await toggleFavorite(s);
    if (value === false && data) setData(data.filter((x) => x.id !== s.id));
  };

  if (!user) {
    return (
      <Screen scroll={false} padded={false}>
        <ScreenHeader title={t('tabFavorites')} back={false} />
        <GuestPrompt icon="heart-outline" title="Sevimli xizmatlar" message="Yoqqan xizmatlaringizni saqlash uchun tizimga kiring." />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <ScreenHeader title={t('tabFavorites')} back={false} />
      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
          ListEmptyComponent={
            <EmptyState icon="heart-outline" title="Hali sevimlilar yo‘q" message="Xizmat kartochkasidagi yurakcha belgisini bosing." actionLabel="Xizmatlarni ko‘rish" onAction={() => router.navigate('/search')} />
          }
          renderItem={({ item }) => (
            <View>
              <ServiceCard service={item} onPress={() => router.push(`/service/${item.id}`)} onToggleFavorite={() => remove(item)} />
            </View>
          )}
        />
      )}
    </Screen>
  );
}
