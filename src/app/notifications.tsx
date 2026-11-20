import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { ordersApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Screen, ScreenHeader } from '@/components/Screen';
import { EmptyState, ErrorState, GuestPrompt, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { colors, typo } from '@/theme';
import { formatDate } from '@/utils/format';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const dialog = useDialog();
  const { data, loading, error, reload, refresh, refreshing, silentReload } = useFetch(
    () => ordersApi.notifications(),
    [user?.id],
    !!user
  );
  useRefetchOnFocus(() => user && silentReload());

  const openNotification = async (id: number, orderId: number | null) => {
    try {
      await ordersApi.markNotificationRead(id);
      await silentReload();
      if (orderId !== null) router.navigate('/orders');
    } catch (e) {
      await dialog.error(e);
    }
  };

  if (!user) {
    return (
      <Screen scroll={false} padded={false}>
        <ScreenHeader title="Bildirishnomalar" />
        <GuestPrompt icon="notifications-outline" title="Bildirishnomalar" message="Bildirishnomalarni ko‘rish uchun tizimga kiring." />
      </Screen>
    );
  }

  return (
    <Screen padded={false} refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Bildirishnomalar" back={false} />
      <View style={{ padding: 16, gap: 12 }}>
        {loading ? <LoadingView /> : error ? <ErrorState message={error} onRetry={reload} /> : null}
        {!loading && !error && (data?.items.length ?? 0) === 0 ? (
          <EmptyState icon="notifications-outline" title="Bildirishnomalar yo‘q" message="Buyurtma va sharhlar haqidagi yangiliklar shu yerda ko‘rinadi." />
        ) : null}
        {!loading && !error && data?.items.map((item) => (
          <Card key={item.id} style={item.read_at ? undefined : { borderColor: colors.greenMid, borderWidth: 1 }}>
            <Text style={typo.bodyBold}>{item.title}</Text>
            <Text style={[typo.body, { color: colors.muted, marginTop: 4 }]}>{item.message}</Text>
            <Text style={[typo.caption, { marginTop: 8 }]}>{formatDate(item.created_at)}</Text>
            {item.read_at ? null : (
              <Button
                title={item.order_id !== null ? 'Buyurtmani ko‘rish' : 'O‘qildi deb belgilash'}
                small
                variant="secondary"
                onPress={() => openNotification(item.id, item.order_id)}
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
              />
            )}
          </Card>
        ))}
      </View>
    </Screen>
  );
}
