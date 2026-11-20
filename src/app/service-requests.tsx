import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen, ScreenHeader } from '@/components/Screen';
import { EmptyState, ErrorState, GuestPrompt, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { marketplaceApi } from '@/api/endpoints';
import { colors, typo } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';

export default function ServiceRequestsScreen() {
  const { user } = useAuth();
  const { data, loading, error, reload, refresh, refreshing } = useFetch(
    () => marketplaceApi.requests(),
    [user?.id],
    !!user
  );
  if (!user) {
    return (
      <Screen scroll={false} padded={false}>
        <ScreenHeader title="Xizmat so‘rovlari" />
        <GuestPrompt icon="megaphone-outline" title="Xizmat so‘rovlari" message="E’lon va takliflarni ko‘rish uchun tizimga kiring." />
      </Screen>
    );
  }
  const isClient = user.role === 'client';

  return (
    <Screen padded={false} refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title={isClient ? 'Mening e’lonlarim' : 'Mijozlar so‘rovlari'} back={false} />
      <View style={{ padding: 16, gap: 12 }}>
        {isClient ? (
          <Button title="Xizmat so‘rovini e’lon qilish" icon="add-circle-outline" onPress={() => router.push('/service-request/new')} />
        ) : null}
        {loading ? <LoadingView /> : error ? <ErrorState message={error} onRetry={reload} /> : null}
        {!loading && !error && !data?.length ? (
          <EmptyState
            icon="megaphone-outline"
            title={isClient ? 'E’lonlar yo‘q' : 'Mos so‘rovlar yo‘q'}
            message={isClient ? 'Kerakli xizmatingiz uchun so‘rov e’lon qiling.' : 'Shahringizdagi yangi mijoz so‘rovlari shu yerda ko‘rinadi.'}
            actionLabel={isClient ? 'E’lon berish' : undefined}
            onAction={isClient ? () => router.push('/service-request/new') : undefined}
          />
        ) : null}
        {data?.map((item) => (
          <Card key={item.id} onPress={() => router.push(`/service-request/${item.id}`)}>
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
              <Text style={[typo.h3, { flex: 1 }]}>{item.title}</Text>
              <Text style={[typo.caption, { color: item.status === 'open' ? colors.greenMid : colors.muted }]}>{item.status === 'open' ? 'Ochiq' : item.status === 'awarded' ? 'Taklif tanlangan' : 'Yopilgan'}</Text>
            </View>
            <Text style={[typo.small, { marginTop: 6 }]}>{item.city} · {formatDate(item.created_at)}</Text>
            {item.budget_max !== null ? (
              <Text style={[typo.bodyBold, { marginTop: 8 }]}>
                Budjet: {item.budget_min ? `${formatPrice(item.budget_min)} – ` : ''}{formatPrice(item.budget_max)}
              </Text>
            ) : null}
            <Text style={[typo.body, { color: colors.muted, marginTop: 8 }]} numberOfLines={3}>{item.description}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
