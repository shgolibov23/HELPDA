import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { businessApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Chip, InfoBox } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Input } from '@/components/Input';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { ErrorState, LoadingView } from '@/components/States';
import { useFetch } from '@/hooks/useFetch';
import { typo } from '@/theme';

export default function ServiceFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const dialog = useDialog();
  const me = useFetch(() => businessApi.me(), []);
  const existing = useFetch(() => businessApi.service(editId as number), [editId], editId !== null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const s = existing.data;
    if (s) {
      // Editing fields are hydrated only after the requested service finishes loading.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(s.name);
      setDescription(s.description ?? '');
      setPrice(String(Math.round(s.price)));
      setCategoryId(s.category?.id ?? null);
      setImageUrl(s.image_url ?? '');
    }
  }, [existing.data]);

  if (me.loading || existing.loading) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Xizmat" />
        <LoadingView />
      </Screen>
    );
  }
  const loadError = me.error ?? existing.error;
  if (loadError) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Xizmat" />
        <ErrorState message={loadError} onRetry={() => { me.reload(); existing.reload(); }} />
      </Screen>
    );
  }

  const save = async () => {
    const e: Record<string, string> = {};
    const priceNum = Number(price.replace(/\s/g, ''));
    if (name.trim().length < 3) e.name = 'Nom kamida 3 ta belgidan iborat bo‘lsin';
    if (!price.trim() || Number.isNaN(priceNum) || priceNum < 0) e.price = 'Narxni to‘g‘ri kiriting (0 = kelishiladi)';
    if (categoryId === null) e.category = 'Kategoriyani tanlang';
    if (imageUrl.trim() && !/^https?:\/\//i.test(imageUrl.trim())) e.image = 'Havola http:// yoki https:// bilan boshlansin';
    setErrors(e);
    if (Object.keys(e).length || categoryId === null) return;

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      category_id: categoryId,
      image_url: imageUrl.trim() || null,
    };
    try {
      await dialog.withLoading(
        async () => {
          if (editId) await businessApi.updateService(editId, body);
          else await businessApi.createService(body);
        },
        'Saqlanmoqda...'
      );
      await dialog.notify({ type: 'success', title: editId ? 'Xizmat yangilandi' : 'Xizmat qo‘shildi' });
      router.back();
    } catch (err) {
      await dialog.error(err, 'Saqlab bo‘lmadi');
    }
  };

  return (
    <Screen keyboard edges={STACK_EDGES} padded={false}>
      <ScreenHeader title={editId ? 'Xizmatni tahrirlash' : 'Yangi xizmat'} />
      <View style={{ padding: 16 }}>
        <Input label="Xizmat nomi" icon="pricetag-outline" value={name} onChangeText={setName} error={errors.name} />
        <Input label="Tavsif" value={description} onChangeText={setDescription} multiline placeholder="Xizmat nimalarni o‘z ichiga oladi?" />
        <Input label="Narx (so‘m)" icon="cash-outline" value={price} onChangeText={setPrice} error={errors.price} keyboardType="numeric" />

        <Text style={[typo.label, { marginBottom: 10 }]}>Kategoriya</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: errors.category ? 4 : 16 }}>
          {(me.data?.business.categories ?? []).map((c) => (
            <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>
        {errors.category ? <Text style={{ color: '#D64545', fontSize: 12.5, fontWeight: '600', marginBottom: 14 }}>{errors.category}</Text> : null}

        <Input label="Rasm havolasi (ixtiyoriy)" icon="image-outline" value={imageUrl} onChangeText={setImageUrl} error={errors.image} autoCapitalize="none" keyboardType="url" hint="Rasm yuklash hozircha mavjud emas, faqat havola qo‘shish mumkin" />

        <InfoBox text="Xizmat e’lon qilingandan so‘ng admin uni moderatsiya qilishi mumkin." icon="information-circle-outline" />
        <Button title={editId ? 'Saqlash' : 'Xizmatni qo‘shish'} onPress={save} style={{ marginTop: 16 }} />
      </View>
    </Screen>
  );
}
