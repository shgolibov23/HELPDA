import { router } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { businessApi } from '@/api/endpoints';
import { useFetch } from '@/hooks/useFetch';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { colors, typo, makeStyles } from '@/theme';
import type { Service } from '@/types';
import { formatPrice } from '@/utils/format';

import { Button } from './Button';
import { Badge, Card } from './Card';
import { useDialog } from './DialogProvider';
import { EmptyState, ErrorState, LoadingView } from './States';

export function BusinessServices({ onChanged }: { onChanged: () => void }) {
  const dialog = useDialog();
  const { data, loading, error, reload, silentReload, setData } = useFetch(() => businessApi.services(), []);
  useRefetchOnFocus(() => {
    silentReload();
    onChanged();
  });

  const toggle = async (s: Service) => {
    try {
      const res = await businessApi.toggleService(s.id);
      setData((data ?? []).map((x) => (x.id === s.id ? { ...x, is_active: res.is_active } : x)));
      onChanged();
    } catch (e) {
      await dialog.error(e);
    }
  };

  const remove = async (s: Service) => {
    const ok = await dialog.confirm({
      title: 'Xizmatni o‘chirasizmi?',
      message: `“${s.name}” butunlay o‘chiriladi. Oldingi buyurtmalar tarixi saqlanadi.`,
      icon: 'trash',
      tone: 'danger',
      confirmText: 'O‘chirish',
    });
    if (!ok) return;
    try {
      await dialog.withLoading(() => businessApi.deleteService(s.id), 'O‘chirilmoqda...');
      setData((data ?? []).filter((x) => x.id !== s.id));
      onChanged();
      await dialog.notify({ type: 'success', title: 'Xizmat o‘chirildi' });
    } catch (e) {
      await dialog.error(e);
    }
  };

  if (loading) return <LoadingView />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <View style={{ gap: 12 }}>
      <Button title="Yangi xizmat qo‘shish" icon="add-circle-outline" onPress={() => router.push('/service-form')} />
      {(data ?? []).length === 0 ? (
        <EmptyState icon="pricetags-outline" title="Hali xizmat yo‘q" message="Birinchi xizmatingizni qo‘shing, mijozlar uni shu zahoti ko‘radi." />
      ) : (
        (data ?? []).map((s) => (
          <Card key={s.id}>
            <View style={styles.top}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={typo.h3} numberOfLines={2}>
                  {s.name}
                </Text>
                <Text style={typo.small}>{s.category?.name ?? 'Kategoriyasiz'}</Text>
                <Text style={styles.price}>{formatPrice(s.price)}</Text>
              </View>
              <Switch
                value={s.is_active}
                onValueChange={() => toggle(s)}
                trackColor={{ true: colors.green, false: colors.border }}
                disabled={s.is_blocked}
              />
            </View>
            <View style={styles.badges}>
              <Badge label={s.is_active ? 'Faol' : 'Nofaol'} tone={s.is_active ? 'success' : 'neutral'} />
              {s.is_blocked ? <Badge label="Admin tomonidan bloklangan" tone="danger" /> : null}
            </View>
            <View style={styles.actions}>
              <Button title="Tahrirlash" icon="create-outline" variant="secondary" small onPress={() => router.push({ pathname: '/service-form', params: { id: String(s.id) } })} />
              <Button title="O‘chirish" icon="trash-outline" variant="ghost" small onPress={() => remove(s)} />
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  top: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  price: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
}));
