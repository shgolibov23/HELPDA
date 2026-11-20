import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { businessApi } from '@/api/endpoints';
import { useFetch } from '@/hooks/useFetch';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { colors, typo, makeStyles } from '@/theme';
import type { Order, OrderStatus } from '@/types';
import { formatDate, formatPhone, formatPrice } from '@/utils/format';

import { Button } from './Button';
import { Card, Chip, InfoBox } from './Card';
import { useDialog } from './DialogProvider';
import { Input } from './Input';
import { OrderStatusBadge } from './StatusBadge';
import { EmptyState, ErrorState, LoadingView } from './States';

const FILTERS: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: 'Yangi' },
  { key: 'accepted', label: 'Qabul qilingan' },
  { key: 'rejected', label: 'Rad etilgan' },
  { key: 'completed', label: 'Yakunlangan' },
];

export function BusinessOrders({ onChanged }: { onChanged: () => void }) {
  const dialog = useDialog();
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [agreements, setAgreements] = useState<Record<number, { scope: string; deadline: string; price: string }>>({});
  const { data, loading, error, reload, silentReload } = useFetch(() => businessApi.orders(status), [status]);
  useRefetchOnFocus(silentReload);

  const act = async (o: Order, action: 'accept' | 'reject' | 'complete') => {
    let reason: string | undefined;
    let agreement: { agreed_scope?: string; deadline_at?: string; final_price?: number } | undefined;
    if (action === 'reject') {
      const r = await dialog.prompt({
        title: 'Buyurtmani rad etasizmi?',
        message: 'Mijozga ko‘rsatiladigan sababni yozing.',
        placeholder: 'Masalan: Bu sanada band',
        icon: 'close-circle',
        tone: 'danger',
        confirmText: 'Rad etish',
        minLength: 3,
      });
      if (r === null) return;
      reason = r;
    } else {
      if (action === 'accept') {
        const draft = agreements[o.id] ?? { scope: o.agreed_scope ?? o.message ?? '', deadline: '', price: String(o.price) };
        const deadlineAt = draft.deadline.trim() ? new Date(`${draft.deadline.trim()}T23:59:00Z`) : null;
        const finalPrice = Number(draft.price);
        if (draft.scope.trim().length < 5 || !deadlineAt || Number.isNaN(deadlineAt.getTime()) || deadlineAt <= new Date() || !Number.isFinite(finalPrice) || finalPrice < 0) {
          await dialog.notify({ type: 'error', title: 'Ish hajmi, kelajakdagi muddat va kelishilgan narxni kiriting' });
          return;
        }
        agreement = { agreed_scope: draft.scope.trim(), deadline_at: deadlineAt.toISOString(), final_price: finalPrice };
      }
      const ok = await dialog.confirm({
        title: action === 'accept' ? 'Buyurtmani qabul qilasizmi?' : 'Buyurtma yakunlandimi?',
        message:
          action === 'accept'
            ? 'Ko‘rsatilgan ish hajmi, muddat va narx buyurtma tarixida saqlanadi.'
            : 'Yakunlangach, mijoz sharh qoldira oladi.',
        icon: action === 'accept' ? 'checkmark-circle' : 'ribbon',
        tone: 'success',
        confirmText: action === 'accept' ? 'Qabul qilish' : 'Yakunlash',
      });
      if (!ok) return;
    }
    try {
      await dialog.withLoading(() => businessApi.orderAction(o.id, action, reason, agreement));
      reload();
      onChanged();
    } catch (e) {
      await dialog.error(e);
    }
  };

  const call = (phone: string) =>
    Linking.openURL(`tel:+${phone}`).catch(() => dialog.notify({ type: 'error', title: 'Qo‘ng‘iroq qilib bo‘lmadi' }));

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>
      <InfoBox text="Onlayn to‘lov mavjud emas. Narx va to‘lov shartlarini mijoz bilan o‘zingiz kelishasiz." icon="card-outline" tone="warning" />

      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon="receipt-outline" title="Buyurtmalar yo‘q" message="Bu bo‘limda hozircha buyurtma yo‘q." />
      ) : (
        (data ?? []).map((o) => (
          <Card key={o.id}>
            <View style={styles.row}>
              <Text style={[typo.h3, { flex: 1 }]}>{o.service_name}</Text>
              <OrderStatusBadge status={o.status} />
            </View>
            <Text style={[typo.small, { marginTop: 4 }]}>
              {o.customer?.full_name} · {formatDate(o.created_at)}
            </Text>
            <Text style={styles.price}>{formatPrice(o.price)}</Text>
            <Text style={typo.body}>Tel: {formatPhone(o.contact_phone)}</Text>
            {o.address ? <Text style={typo.body}>Manzil: {o.address}</Text> : null}
            {o.message ? <Text style={[typo.body, { color: colors.muted, marginTop: 4 }]}>“{o.message}”</Text> : null}
            {o.agreed_scope ? <Text style={[typo.body, { marginTop: 8 }]}>Kelishilgan ish: {o.agreed_scope}</Text> : null}
            {o.deadline_at ? <Text style={typo.small}>Muddat: {formatDate(o.deadline_at)}</Text> : null}
            {o.booking_slot_id ? <Text style={typo.small}>Mijoz band qilgan vaqt: #{o.booking_slot_id}</Text> : null}
            {o.rejection_reason ? <Text style={styles.reason}>Sabab: {o.rejection_reason}</Text> : null}
            {o.status === 'pending' ? (
              <View style={{ marginTop: 10 }}>
                <Input
                  label="Kelishilgan ish hajmi"
                  value={agreements[o.id]?.scope ?? o.agreed_scope ?? o.message ?? ''}
                  onChangeText={(scope) => setAgreements((values) => ({ ...values, [o.id]: { scope, deadline: values[o.id]?.deadline ?? '', price: values[o.id]?.price ?? String(o.price) } }))}
                  multiline
                />
                <Input
                  label="Bajarish sanasi (YYYY-MM-DD)"
                  value={agreements[o.id]?.deadline ?? ''}
                  onChangeText={(deadline) => setAgreements((values) => ({ ...values, [o.id]: { scope: values[o.id]?.scope ?? o.agreed_scope ?? o.message ?? '', deadline, price: values[o.id]?.price ?? String(o.price) } }))}
                  placeholder="2026-12-01"
                />
                <Input
                  label="Kelishilgan narx (so‘m)"
                  value={agreements[o.id]?.price ?? String(o.price)}
                  onChangeText={(price) => setAgreements((values) => ({ ...values, [o.id]: { scope: values[o.id]?.scope ?? o.agreed_scope ?? o.message ?? '', deadline: values[o.id]?.deadline ?? '', price } }))}
                  keyboardType="numeric"
                />
              </View>
            ) : null}
            <View style={styles.actions}>
              <Button title={formatPhone(o.contact_phone)} icon="call-outline" variant="secondary" small onPress={() => call(o.contact_phone)} />
              <Button title="Xabarlar" icon="chatbubble-outline" variant="secondary" small onPress={() => router.push(`/order-chat/${o.id}`)} />
              {o.status === 'pending' ? (
                <>
                  <Button title="Qabul qilish" small onPress={() => act(o, 'accept')} />
                  <Button title="Rad etish" variant="ghost" small onPress={() => act(o, 'reject')} />
                </>
              ) : null}
              {o.status === 'accepted' ? <Button title="Yakunlash" icon="ribbon-outline" small onPress={() => act(o, 'complete')} /> : null}
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  price: { fontSize: 16, fontWeight: '800', marginVertical: 8 },
  reason: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
}));
