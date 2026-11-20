import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { catalogApi, marketplaceApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Input } from '@/components/Input';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { ErrorState, LoadingView } from '@/components/States';
import { useFetch } from '@/hooks/useFetch';
import { colors, typo } from '@/theme';

export default function NewServiceRequestScreen() {
  const dialog = useDialog();
  const categories = useFetch(() => catalogApi.categories(), []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');

  const submit = async () => {
    const min = budgetMin.trim() ? Number(budgetMin) : undefined;
    const max = budgetMax.trim() ? Number(budgetMax) : undefined;
    if (budgetMin.trim() && (!Number.isFinite(min) || min! < 0) || budgetMax.trim() && (!Number.isFinite(max) || max! < 0)) {
      await dialog.notify({ type: 'error', title: 'Budjet summasini tekshiring' });
      return;
    }
    try {
      await dialog.withLoading(() => marketplaceApi.createRequest({
        title: title.trim(),
        description: description.trim(),
        city: city.trim(),
        category_id: categoryId ?? undefined,
        budget_min: min,
        budget_max: max,
      }), 'E’lon yuborilmoqda...');
      await dialog.notify({ type: 'success', title: 'E’lon joylandi', message: 'Mos bizneslar taklif yuborishi mumkin.' });
      router.replace('/service-requests');
    } catch (error) {
      await dialog.error(error);
    }
  };

  if (categories.loading || categories.error || !categories.data) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Xizmat so‘rovi" />
        {categories.loading ? <LoadingView /> : <ErrorState message={categories.error ?? ''} onRetry={categories.reload} />}
      </Screen>
    );
  }

  return (
    <Screen keyboard edges={STACK_EDGES} padded={false}>
      <ScreenHeader title="Xizmat so‘rovi" subtitle="Bizneslardan narx takliflarini oling" />
      <View style={{ padding: 16 }}>
        <Input label="Nima xizmat kerak?" value={title} onChangeText={setTitle} maxLength={150} placeholder="Masalan: Uy ta’miri" />
        <Input label="Batafsil talab" value={description} onChangeText={setDescription} multiline maxLength={3000} placeholder="Ish hajmi, shartlar va talablarni yozing" />
        <Input label="Shahar" value={city} onChangeText={setCity} maxLength={100} placeholder="Toshkent" />
        <Text style={[typo.label, { marginBottom: 8 }]}>Yo‘nalish (ixtiyoriy)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <Chip label="Tanlanmagan" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          {categories.data.map((category) => (
            <Chip key={category.id} label={category.name} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Budjetdan (ixtiyoriy)" value={budgetMin} onChangeText={setBudgetMin} keyboardType="numeric" placeholder="0" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Budjetgacha" value={budgetMax} onChangeText={setBudgetMax} keyboardType="numeric" placeholder="So‘m" />
          </View>
        </View>
        <Text style={[typo.caption, { color: colors.muted, marginBottom: 12 }]}>E’lon faqat faol bizneslarga ko‘rinadi. To‘lov va ish shartlarini biznes bilan kelishasiz.</Text>
        <Button title="E’lonni joylash" icon="megaphone-outline" onPress={submit} />
      </View>
    </Screen>
  );
}
