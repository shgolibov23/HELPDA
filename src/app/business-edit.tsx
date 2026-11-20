import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { businessApi, catalogApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { useDialog } from '@/components/DialogProvider';
import { Chip } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { ErrorState, LoadingView } from '@/components/States';
import { useFetch } from '@/hooks/useFetch';
import { normalizePhone } from '@/utils/format';

export default function BusinessEditScreen() {
  const dialog = useDialog();
  const me = useFetch(() => businessApi.me(), []);
  const categories = useFetch(() => catalogApi.categories(), []);
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [logo, setLogo] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [portfolioImages, setPortfolioImages] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const b = me.data?.business;
    if (b && categories.data) {
      // Editing fields are hydrated only after the business profile has loaded.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDescription(b.description ?? '');
      setPhone(b.phone);
      setCity(b.city ?? '');
      setAddress(b.address ?? '');
      setLogo(b.logo ?? '');
      setWorkingHours(b.working_hours ?? '');
      setPortfolioImages((b.portfolio_images ?? []).join('\n'));
      setMapsUrl(b.maps_url ?? '');
      setCategoryIds(b.categories.map((category) => category.id));
    }
  }, [me.data, categories.data]);

  if (me.loading || categories.loading || me.error || categories.error || !me.data || !categories.data) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Biznes profili" />
        {me.loading || categories.loading ? (
          <LoadingView />
        ) : (
          <ErrorState message={me.error ?? categories.error ?? ''} onRetry={() => { me.reload(); categories.reload(); }} />
        )}
      </Screen>
    );
  }

  const save = async () => {
    const e: Record<string, string> = {};
    const normalized = normalizePhone(phone);
    if (!normalized) e.phone = 'Telefon raqami noto‘g‘ri';
    if (city.trim().length < 2) e.city = 'Shaharni kiriting';
    if (address.trim().length < 3) e.address = 'Manzilni kiriting';
    if (!categoryIds.length) e.categories = 'Kamida bitta yo‘nalishni tanlang';
    if (logo.trim() && !/^https?:\/\//i.test(logo.trim())) e.logo = 'Havola http:// yoki https:// bilan boshlansin';
    const portfolio = portfolioImages.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    if (portfolio.length > 8) e.portfolio = 'Ko‘pi bilan 8 ta rasm havolasi kiriting';
    if (portfolio.some((url) => !/^https?:\/\//i.test(url))) e.portfolio = 'Har bir rasm havolasi http:// yoki https:// bilan boshlansin';
    if (mapsUrl.trim() && !/^https?:\/\//i.test(mapsUrl.trim())) e.maps = 'Xarita havolasi http:// yoki https:// bilan boshlansin';
    setErrors(e);
    if (Object.keys(e).length || !normalized) return;
    try {
      await dialog.withLoading(
        () =>
          businessApi.update({
            description: description.trim() || null,
            phone: normalized,
            city: city.trim(),
            address: address.trim(),
            logo: logo.trim() || null,
            working_hours: workingHours.trim() || null,
            portfolio_images: portfolio,
            maps_url: mapsUrl.trim() || null,
            category_ids: categoryIds,
          }),
        'Saqlanmoqda...'
      );
      await dialog.notify({ type: 'success', title: 'Saqlandi', message: 'Biznes ma’lumotlari yangilandi.' });
      router.back();
    } catch (err) {
      await dialog.error(err);
    }
  };

  return (
    <Screen keyboard edges={STACK_EDGES} padded={false}>
      <ScreenHeader title="Biznes profili" subtitle={me.data.business.name} />
      <View style={{ padding: 16 }}>
        <Input label="Tavsif" value={description} onChangeText={setDescription} multiline placeholder="Kompaniya haqida qisqacha" />
        <Input label="Telefon" icon="call-outline" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" />
        <Input label="Shahar" icon="location-outline" value={city} onChangeText={setCity} error={errors.city} />
        <Input label="Manzil" icon="map-outline" value={address} onChangeText={setAddress} error={errors.address} />
        <Input label="Logo havolasi (ixtiyoriy)" icon="image-outline" value={logo} onChangeText={setLogo} error={errors.logo} autoCapitalize="none" keyboardType="url" />
        <Input label="Ish vaqti (ixtiyoriy)" icon="time-outline" value={workingHours} onChangeText={setWorkingHours} placeholder="Du-Sha: 09:00-18:00" />
        <Input
          label="Portfolio rasmlari havolalari (har qatorda bittadan, ko‘pi bilan 8 ta)"
          icon="images-outline"
          value={portfolioImages}
          onChangeText={setPortfolioImages}
          error={errors.portfolio}
          multiline
          autoCapitalize="none"
          keyboardType="url"
        />
        <Input label="Xarita havolasi (ixtiyoriy)" icon="map-outline" value={mapsUrl} onChangeText={setMapsUrl} error={errors.maps} autoCapitalize="none" keyboardType="url" />
        <Text style={{ fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 4 }}>Faoliyat yo‘nalishlari</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: errors.categories ? 4 : 14 }}>
          {(categories.data ?? []).map((category) => {
            const selected = categoryIds.includes(category.id);
            return (
              <Chip
                key={category.id}
                label={category.name}
                selected={selected}
                onPress={() => setCategoryIds((items) =>
                  selected ? items.filter((id) => id !== category.id) : items.length < 8 ? [...items, category.id] : items
                )}
              />
            );
          })}
        </View>
        {errors.categories ? <Text style={{ color: '#D64545', fontSize: 12.5, fontWeight: '600', marginBottom: 14 }}>{errors.categories}</Text> : null}
        <Button title="Saqlash" onPress={save} style={{ marginTop: 8 }} />
      </View>
    </Screen>
  );
}
