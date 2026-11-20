import { useState } from 'react';
import { Text, View } from 'react-native';

import { marketplaceApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Input } from '@/components/Input';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { colors, typo } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import type { AvailabilitySlot } from '@/types';

function localDateToIso(value: string): string | null {
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export default function BusinessToolsScreen() {
  const { user } = useAuth();
  const dialog = useDialog();
  const slots = useFetch(() => marketplaceApi.businessSlots(), [user?.id], user?.role === 'business');
  const coupons = useFetch(() => marketplaceApi.coupons(), [user?.id], user?.role === 'business');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');

  useRefetchOnFocus(() => {
    if (user?.role === 'business') {
      slots.silentReload();
      coupons.silentReload();
    }
  });

  if (user?.role !== 'business') {
    return (
      <Screen edges={STACK_EDGES} padded={false}>
        <ScreenHeader title="Bo‘sh vaqt va kuponlar" />
        <EmptyState icon="lock-closed-outline" title="Biznes bo‘limi" message="Bu bo‘lim faqat faol biznes egalariga ochiq." />
      </Screen>
    );
  }

  const addSlot = async () => {
    const start = localDateToIso(startsAt);
    const end = localDateToIso(endsAt);
    if (!start || !end) {
      await dialog.notify({ type: 'error', title: 'Sana va vaqtni YYYY-MM-DD HH:mm formatida kiriting' });
      return;
    }
    try {
      await dialog.withLoading(() => marketplaceApi.addSlot({ starts_at: start, ends_at: end }), 'Vaqt qo‘shilmoqda...');
      setStartsAt('');
      setEndsAt('');
      await slots.reload();
      await dialog.notify({ type: 'success', title: 'Bo‘sh vaqt qo‘shildi' });
    } catch (error) {
      await dialog.error(error);
    }
  };

  const addCoupon = async () => {
    const amount = Number(value);
    const max = maxRedemptions.trim() ? Number(maxRedemptions) : undefined;
    if (!Number.isFinite(amount) || amount <= 0 || max !== undefined && (!Number.isInteger(max) || max <= 0)) {
      await dialog.notify({ type: 'error', title: 'Chegirma qiymati va limitini tekshiring' });
      return;
    }
    try {
      await dialog.withLoading(() => marketplaceApi.createCoupon({
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        value: amount,
        max_redemptions: max,
      }), 'Kupon yaratilmoqda...');
      setCode('');
      setValue('');
      setMaxRedemptions('');
      await coupons.reload();
      await dialog.notify({ type: 'success', title: 'Kupon yaratildi' });
    } catch (error) {
      await dialog.error(error);
    }
  };

  const toggleCoupon = async (id: number, isActive: boolean) => {
    try {
      await dialog.withLoading(() => marketplaceApi.setCouponActive(id, !isActive));
      await coupons.reload();
    } catch (error) {
      await dialog.error(error);
    }
  };

  return (
    <Screen keyboard edges={STACK_EDGES} padded={false} refreshing={slots.refreshing || coupons.refreshing} onRefresh={() => { slots.refresh(); coupons.refresh(); }}>
      <ScreenHeader title="Bo‘sh vaqt va kuponlar" subtitle="Mijozlar uchun band qilish va chegirma" />
      <View style={{ padding: 16, gap: 12 }}>
        <Card>
          <Text style={typo.h3}>Bo‘sh vaqt qo‘shish</Text>
          <Text style={[typo.caption, { marginTop: 4, marginBottom: 10 }]}>Qurilmangiz vaqti bo‘yicha kiriting: YYYY-MM-DD HH:mm</Text>
          <Input label="Boshlanish" value={startsAt} onChangeText={setStartsAt} placeholder="2026-12-01 09:00" />
          <Input label="Tugash" value={endsAt} onChangeText={setEndsAt} placeholder="2026-12-01 10:00" />
          <Button title="Vaqt qo‘shish" small onPress={addSlot} />
          {slots.loading ? <LoadingView /> : slots.error ? <ErrorState message={slots.error} onRetry={slots.reload} /> : null}
          {slots.data?.map((slot: AvailabilitySlot) => (
            <View key={slot.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <Text style={[typo.small, { flex: 1 }]}>{formatDate(slot.starts_at)} – {formatDate(slot.ends_at)} · {slot.status}</Text>
              {slot.status === 'available' ? <Button title="O‘chirish" variant="ghost" small onPress={() => marketplaceApi.deleteSlot(slot.id).then(slots.reload).catch(dialog.error)} /> : null}
            </View>
          ))}
        </Card>

        <Card>
          <Text style={typo.h3}>Chegirma kuponi yaratish</Text>
          <Input label="Kod" value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={40} placeholder="WELCOME10" />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Button title="Foiz" small variant={discountType === 'percent' ? 'primary' : 'secondary'} onPress={() => setDiscountType('percent')} style={{ flex: 1 }} />
            <Button title="So‘m" small variant={discountType === 'fixed' ? 'primary' : 'secondary'} onPress={() => setDiscountType('fixed')} style={{ flex: 1 }} />
          </View>
          <Input label={discountType === 'percent' ? 'Chegirma foizi' : 'Chegirma (so‘m)'} value={value} onChangeText={setValue} keyboardType="numeric" />
          <Input label="Ishlatish soni limiti (ixtiyoriy)" value={maxRedemptions} onChangeText={setMaxRedemptions} keyboardType="numeric" />
          <Button title="Kupon yaratish" onPress={addCoupon} />
        </Card>

        <Text style={typo.h3}>Kuponlarim</Text>
        {coupons.loading ? <LoadingView /> : coupons.error ? <ErrorState message={coupons.error} onRetry={coupons.reload} /> : null}
        {coupons.data?.map((coupon) => (
          <Card key={coupon.id}>
            <Text style={typo.h3}>{coupon.code}</Text>
            <Text style={[typo.body, { color: colors.muted }]}>{coupon.discount_type === 'percent' ? `${coupon.value}%` : formatPrice(coupon.value)} chegirma{coupon.max_redemptions ? ` · limit ${coupon.max_redemptions}` : ''}</Text>
            <Button title={coupon.is_active ? 'O‘chirish' : 'Faollashtirish'} variant="secondary" small onPress={() => toggleCoupon(coupon.id, coupon.is_active)} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}
