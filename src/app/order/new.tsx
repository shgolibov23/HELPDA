import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { catalogApi, ordersApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Card, Chip, InfoBox } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Input } from '@/components/Input';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { ErrorState, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { t } from '@/i18n';
import { typo } from '@/theme';
import { goToTab } from '@/utils/nav';
import { formatDate, formatPrice, normalizePhone } from '@/utils/format';
import type { AvailabilitySlot } from '@/types';

export default function NewOrderScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { user } = useAuth();
  const dialog = useDialog();
  const service = useFetch(() => catalogApi.service(Number(serviceId)), [serviceId]);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(false);
  const slots = useFetch(
    () => ordersApi.availableSlots(service.data!.business.id),
    [service.data?.business.id],
    !!service.data
  );
  const loyalty = useFetch(() => ordersApi.loyalty(), [user?.id], !!user);

  if (service.loading || service.error || !service.data) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Buyurtma" />
        {service.loading ? <LoadingView /> : <ErrorState message={service.error ?? t('unknownError')} onRetry={service.reload} />}
      </Screen>
    );
  }
  const s = service.data;

  const submit = async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setPhoneError('Telefon raqami noto‘g‘ri. Namuna: 90 123 45 67');
      return;
    }
    setPhoneError(null);
    const ok = await dialog.confirm({
      title: 'Buyurtmani yuborasizmi?',
      message: `“${s.name}” uchun ${s.business.name} ga so‘rov yuboriladi.`,
      icon: 'paper-plane',
      tone: 'info',
      confirmText: 'Yuborish',
    });
    if (!ok) return;
    try {
      await dialog.withLoading(
        () =>
          ordersApi.create({
            service_id: s.id,
            contact_phone: normalized,
            address: address.trim() || undefined,
            message: message.trim() || undefined,
            booking_slot_id: selectedSlot ?? undefined,
            coupon_code: couponCode.trim() || undefined,
            redeem_points: redeemPoints,
          }),
        'Yuborilmoqda...'
      );
      await dialog.notify({
        type: 'success',
        title: 'Buyurtma yuborildi',
        message: 'Xizmat ko‘rsatuvchi javob bergach, holatini “Buyurtmalar” bo‘limida ko‘rasiz.',
      });
      goToTab('/orders');
    } catch (e) {
      await dialog.error(e, 'Buyurtma yuborilmadi');
    }
  };

  return (
    <Screen keyboard edges={STACK_EDGES} padded={false}>
      <ScreenHeader title="Buyurtma berish" />
      <View style={{ padding: 16, gap: 16 }}>
        <Card>
          <Text style={typo.h3}>{s.name}</Text>
          <Text style={[typo.small, { marginTop: 4 }]}>{s.business.name}</Text>
          <Text style={[typo.h2, { marginTop: 10 }]}>{formatPrice(s.price)}</Text>
        </Card>

        <View>
          <Input label="Aloqa telefoni" icon="call-outline" value={phone} onChangeText={setPhone} error={phoneError} keyboardType="phone-pad" />
          <Input label="Manzil (ixtiyoriy)" icon="location-outline" value={address} onChangeText={setAddress} placeholder="Xizmat ko‘rsatiladigan joy" />
          <Input label="Izoh (ixtiyoriy)" value={message} onChangeText={setMessage} multiline placeholder="Qo‘shimcha talablaringizni yozing" />
        </View>

        <Card>
          <Text style={typo.h3}>Band qilish (ixtiyoriy)</Text>
          {slots.loading ? <LoadingView text="Bo‘sh vaqtlar yuklanmoqda..." /> : null}
          {slots.error ? <ErrorState message={slots.error} onRetry={slots.reload} /> : null}
          {!slots.loading && !slots.error && (slots.data ?? []).length === 0 ? <Text style={[typo.small, { marginTop: 6 }]}>Hozircha band qilinadigan vaqt ko‘rsatilmagan.</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {(slots.data ?? []).map((slot: AvailabilitySlot) => (
              <Chip
                key={slot.id}
                label={`${formatDate(slot.starts_at)} – ${formatDate(slot.ends_at)}`}
                selected={selectedSlot === slot.id}
                onPress={() => setSelectedSlot(selectedSlot === slot.id ? null : slot.id)}
              />
            ))}
          </View>
        </Card>

        <Card>
          <Text style={typo.h3}>Kupon va ballar</Text>
          <Input label="Biznes kupon kodi (ixtiyoriy)" value={couponCode} onChangeText={setCouponCode} autoCapitalize="characters" maxLength={40} />
          {loyalty.data ? (
            <View>
              <Text style={[typo.small, { marginBottom: 8 }]}>Balans: {loyalty.data.points} ball · 1 ball = 100 so‘m (buyurtma narxining ko‘pi bilan 20%).</Text>
              <Chip label={redeemPoints ? 'Ballarni ishlatish yoqilgan' : 'Ballarni ishlatish'} selected={redeemPoints} onPress={() => setRedeemPoints((active) => !active)} />
            </View>
          ) : loyalty.error ? <Text style={[typo.small, { color: '#D64545' }]}>{loyalty.error}</Text> : null}
        </Card>

        <InfoBox text={t('noPaymentNote')} icon="card-outline" tone="warning" />
        <Button title="Buyurtmani yuborish" icon="paper-plane-outline" onPress={submit} />
      </View>
    </Screen>
  );
}
