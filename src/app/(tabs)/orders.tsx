import { router } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { ordersApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Screen, ScreenHeader } from '@/components/Screen';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, GuestPrompt, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { t } from '@/i18n';
import { colors, typo, makeStyles } from '@/theme';
import type { Order } from '@/types';
import { formatDate, formatPrice } from '@/utils/format';

export default function OrdersScreen() {
  const { user } = useAuth();
  const dialog = useDialog();
  const { data, loading, error, refreshing, refresh, reload, silentReload } = useFetch(() => ordersApi.mine(), [user?.id], !!user);
  useRefetchOnFocus(() => user && silentReload());

  const cancel = async (o: Order) => {
    const ok = await dialog.confirm({
      title: 'Buyurtmani bekor qilasizmi?',
      message: `“${o.service_name}” buyurtmasi bekor qilinadi.`,
      icon: 'close-circle',
      tone: 'danger',
      confirmText: 'Bekor qilish',
      cancelText: 'Orqaga',
    });
    if (!ok) return;
    try {
      await dialog.withLoading(() => ordersApi.cancel(o.id), 'Bekor qilinmoqda...');
      await dialog.notify({ type: 'success', title: 'Buyurtma bekor qilindi' });
      reload();
    } catch (e) {
      await dialog.error(e);
    }
  };

  const call = (phone: string) =>
    Linking.openURL(`tel:+${phone}`).catch(() => dialog.notify({ type: 'error', title: 'Qo‘ng‘iroq qilib bo‘lmadi' }));

  if (!user) {
    return (
      <Screen scroll={false} padded={false}>
        <ScreenHeader title={t('tabOrders')} back={false} />
        <GuestPrompt icon="receipt-outline" title="Buyurtmalaringiz" message="Buyurtma berish va kuzatish uchun tizimga kiring." />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} padded={false}>
      <ScreenHeader title={t('tabOrders')} back={false} />
      <View style={{ padding: 16, gap: 14 }}>
        {loading ? (
          <LoadingView />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon="receipt-outline" title="Buyurtmalar yo‘q" message="Xizmat sahifasidan buyurtma bering, u shu yerda ko‘rinadi." actionLabel="Xizmat qidirish" onAction={() => router.navigate('/search')} />
        ) : (
          (data ?? []).map((o) => (
            <Card key={o.id}>
              <View style={styles.row}>
                <Text style={[typo.h3, { flex: 1 }]} numberOfLines={2}>
                  {o.service_name}
                </Text>
                <OrderStatusBadge status={o.status} />
              </View>
              <Text style={[typo.small, { marginTop: 4 }]}>
                {o.business?.name} · {formatDate(o.created_at)}
              </Text>
              <Text style={styles.price}>{formatPrice(o.price)}</Text>
              {o.message ? <Text style={[typo.body, { color: colors.muted }]}>“{o.message}”</Text> : null}
              {o.status === 'rejected' && o.rejection_reason ? (
                <Text style={styles.reason}>Rad etish sababi: {o.rejection_reason}</Text>
              ) : null}
              {o.agreed_scope ? <Text style={[typo.body, { marginTop: 8 }]}>Kelishilgan ish: {o.agreed_scope}</Text> : null}
              {o.deadline_at ? <Text style={[typo.small, { marginTop: 4 }]}>Bajarish muddati: {formatDate(o.deadline_at)}</Text> : null}
              {o.original_price > o.price ? <Text style={[typo.small, { marginTop: 4 }]}>Boshlang‘ich narx: {formatPrice(o.original_price)} · chegirma: {formatPrice(o.discount_amount)}</Text> : null}
              <View style={styles.actions}>
                {o.business ? <Button title={t('call')} icon="call-outline" variant="secondary" small onPress={() => call(o.business!.phone)} /> : null}
                <Button title="Xabarlar" icon="chatbubble-outline" variant="secondary" small onPress={() => router.push(`/order-chat/${o.id}`)} />
                {(o.status === 'pending' || o.status === 'accepted') && (
                  <Button title="Bekor qilish" variant="ghost" small onPress={() => cancel(o)} />
                )}
                {o.status === 'completed' && o.service_id ? (
                  <Button title="Sharh qoldirish" icon="star-outline" small onPress={() => router.push(`/service/${o.service_id}`)} />
                ) : null}
              </View>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  price: { fontSize: 16, fontWeight: '800', marginVertical: 8 },
  reason: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
}));
