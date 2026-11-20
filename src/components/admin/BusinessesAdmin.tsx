import { StyleSheet, Text, View } from 'react-native';

import { adminApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Avatar, Badge, Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { EmptyState, ErrorState, LoadingView } from '@/components/States';
import { useFetch } from '@/hooks/useFetch';
import { typo, makeStyles } from '@/theme';
import type { Business } from '@/types';
import { businessTypeLabel, formatPhone } from '@/utils/format';

export function BusinessesAdmin() {
  const dialog = useDialog();
  const { data, loading, error, reload, setData } = useFetch(() => adminApi.businesses(), []);

  const patch = (id: number, p: Partial<Business>) =>
    setData((data ?? []).map((b) => (b.id === id ? { ...b, ...p } : b)));

  const toggleActive = async (b: Business) => {
    const block = b.is_active;
    const ok = await dialog.confirm({
      title: block ? 'Biznesni bloklaysizmi?' : 'Blokdan chiqarasizmi?',
      message: block ? `“${b.name}” xizmatlari ommaviy ro‘yxatdan yashiriladi.` : `“${b.name}” yana ko‘rinadigan bo‘ladi.`,
      icon: block ? 'ban' : 'lock-open',
      tone: block ? 'danger' : 'success',
      confirmText: block ? 'Bloklash' : 'Faollashtirish',
    });
    if (!ok) return;
    try {
      const res = await adminApi.setBusinessActive(b.id, !b.is_active);
      patch(b.id, { is_active: res.is_active });
    } catch (e) {
      await dialog.error(e);
    }
  };

  const toggleFeatured = async (b: Business) => {
    try {
      const res = await adminApi.setBusinessFeatured(b.id, !b.is_featured);
      patch(b.id, { is_featured: res.is_featured });
    } catch (e) {
      await dialog.error(e);
    }
  };

  if (loading) return <LoadingView />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if ((data ?? []).length === 0) return <EmptyState icon="storefront-outline" title="Bizneslar yo‘q" message="Tasdiqlangan bizneslar shu yerda ko‘rinadi." />;

  return (
    <View style={{ gap: 12 }}>
      {(data ?? []).map((b) => (
        <Card key={b.id}>
          <View style={styles.row}>
            <Avatar name={b.name} uri={b.logo} size={48} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={typo.h3} numberOfLines={1}>{b.name}</Text>
              <Text style={typo.small}>{businessTypeLabel(b.business_type)} · {b.city ?? '—'} · {formatPhone(b.phone)}</Text>
              <Text style={typo.small}>{b.services_count} ta faol xizmat</Text>
            </View>
          </View>
          <View style={styles.badges}>
            <Badge label={b.is_active ? 'Faol' : 'Bloklangan'} tone={b.is_active ? 'success' : 'danger'} />
            {b.is_featured ? <Badge label="Tanlangan" tone="info" icon="sparkles" /> : null}
            <Badge label="Qo‘lda ko‘rilgan" tone="neutral" />
          </View>
          <View style={styles.actions}>
            <Button title={b.is_active ? 'Bloklash' : 'Faollashtirish'} small variant="secondary" onPress={() => toggleActive(b)} />
            <Button title={b.is_featured ? 'Tanlanganlardan olish' : 'Tanlanganlarga qo‘shish'} small variant="ghost" onPress={() => toggleFeatured(b)} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = makeStyles(() => ({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
}));
