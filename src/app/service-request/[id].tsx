import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { marketplaceApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Input } from '@/components/Input';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { ErrorState, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { colors, typo } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';

export default function ServiceRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Number(id);
  const { user } = useAuth();
  const dialog = useDialog();
  const { data, loading, error, reload } = useFetch(() => marketplaceApi.request(requestId), [requestId, user?.id]);
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('');
  const [message, setMessage] = useState('');

  const submitOffer = async () => {
    const offerPrice = Number(price);
    const durationDays = days.trim() ? Number(days) : undefined;
    if (!Number.isFinite(offerPrice) || offerPrice < 0 || durationDays !== undefined && (!Number.isInteger(durationDays) || durationDays < 1)) {
      await dialog.notify({ type: 'error', title: 'Narx yoki muddatni tekshiring' });
      return;
    }
    try {
      await dialog.withLoading(() => marketplaceApi.createOffer(requestId, {
        price: offerPrice,
        duration_days: durationDays,
        message: message.trim(),
      }), 'Taklif yuborilmoqda...');
      setPrice('');
      setDays('');
      setMessage('');
      await reload();
      await dialog.notify({ type: 'success', title: 'Taklif yuborildi' });
    } catch (e) {
      await dialog.error(e);
    }
  };

  const selectOffer = async (offerId: number) => {
    const confirmed = await dialog.confirm({
      title: 'Taklifni tanlaysizmi?',
      message: 'Tanlangan biznes bilan buyurtma yaratiladi, qolgan takliflar yopiladi.',
      icon: 'checkmark-circle-outline',
      confirmText: 'Tanlash',
    });
    if (!confirmed) return;
    try {
      const result = await dialog.withLoading(() => marketplaceApi.selectOffer(offerId), 'Buyurtma yaratilmoqda...');
      await dialog.notify({ type: 'success', title: 'Taklif tanlandi', message: result.message });
      router.replace('/orders');
    } catch (e) {
      await dialog.error(e);
    }
  };

  const closeRequest = async () => {
    const confirmed = await dialog.confirm({
      title: 'E’lonni yopasizmi?',
      message: 'Bizneslar bu e’longa yangi taklif yubora olmaydi.',
      icon: 'close-circle-outline',
      confirmText: 'E’lonni yopish',
    });
    if (!confirmed) return;
    try {
      await dialog.withLoading(() => marketplaceApi.closeRequest(requestId), 'E’lon yopilmoqda...');
      await reload();
      await dialog.notify({ type: 'success', title: 'E’lon yopildi' });
    } catch (e) {
      await dialog.error(e);
    }
  };

  if (loading || error || !data) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Xizmat so‘rovi" />
        {loading ? <LoadingView /> : <ErrorState message={error ?? ''} onRetry={reload} />}
      </Screen>
    );
  }
  const { request, offers } = data;
  const isBusiness = user?.role === 'business';

  return (
    <Screen keyboard edges={STACK_EDGES} padded={false} refreshing={false}>
      <ScreenHeader title="Xizmat so‘rovi" />
      <View style={{ padding: 16, gap: 12 }}>
        <Card>
          <Text style={typo.h2}>{request.title}</Text>
          <Text style={[typo.small, { marginTop: 6 }]}>{request.city} · {request.customer_name ?? 'Mijoz'} · {formatDate(request.created_at)}</Text>
          <Text style={[typo.body, { marginTop: 12 }]}>{request.description}</Text>
          {request.budget_max !== null ? (
            <Text style={[typo.bodyBold, { marginTop: 10 }]}>Budjet: {request.budget_min ? `${formatPrice(request.budget_min)} – ` : ''}{formatPrice(request.budget_max)}</Text>
          ) : null}
          {user?.role === 'client' && request.status === 'open' ? (
            <Button title="E’lonni yopish" variant="secondary" onPress={closeRequest} style={{ marginTop: 12 }} />
          ) : null}
        </Card>

        {isBusiness && request.status === 'open' ? (
          <Card>
            <Text style={typo.h3}>Narx taklif qilish</Text>
            <Input label="Narx (so‘m)" value={price} onChangeText={setPrice} keyboardType="numeric" />
            <Input label="Bajarish muddati (kun)" value={days} onChangeText={setDays} keyboardType="numeric" />
            <Input label="Taklif tafsiloti" value={message} onChangeText={setMessage} multiline maxLength={1500} placeholder="Ish hajmi, shartlar va kafolat" />
            <Button title="Taklifni yuborish" onPress={submitOffer} />
          </Card>
        ) : null}

        <Text style={typo.h3}>Biznes takliflari ({offers.length})</Text>
        {offers.length === 0 ? <Text style={typo.small}>Hozircha taklif yo‘q.</Text> : null}
        {offers.map((offer) => (
          <Card key={offer.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={[typo.bodyBold, { flex: 1 }]}>{offer.business_name}</Text>
              <Text style={[typo.bodyBold, { color: colors.greenMid }]}>{formatPrice(offer.price)}</Text>
            </View>
            {offer.duration_days ? <Text style={typo.small}>Bajarish: {offer.duration_days} kun</Text> : null}
            <Text style={[typo.body, { marginTop: 8 }]}>{offer.message}</Text>
            {user?.role === 'client' && request.status === 'open' && offer.status === 'pending' ? (
              <Button title="Taklifni tanlash" small onPress={() => selectOffer(offer.id)} style={{ marginTop: 10 }} />
            ) : null}
            {offer.status === 'selected' ? <Text style={[typo.caption, { color: colors.greenMid, marginTop: 8 }]}>Tanlandi</Text> : null}
          </Card>
        ))}
      </View>
    </Screen>
  );
}
