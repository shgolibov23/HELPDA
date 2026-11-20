import { StyleSheet, Text, View } from 'react-native';

import { adminApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Badge, Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { EmptyState, ErrorState, LoadingView } from '@/components/States';
import { useFetch } from '@/hooks/useFetch';
import { typo, makeStyles } from '@/theme';
import type { Service } from '@/types';
import { formatPrice } from '@/utils/format';

export function ServicesAdmin() {
  const dialog = useDialog();
  const { data, loading, error, reload, setData } = useFetch(() => adminApi.services(), []);

  const toggle = async (s: Service) => {
    const block = !s.is_blocked;
    const ok = await dialog.confirm({
      title: block ? 'Xizmatni bloklaysizmi?' : 'Blokdan chiqarasizmi?',
      message: block ? `“${s.name}” ommaviy ro‘yxatdan yashiriladi.` : `“${s.name}” yana ko‘rinadigan bo‘ladi.`,
      icon: block ? 'ban' : 'lock-open',
      tone: block ? 'danger' : 'success',
      confirmText: block ? 'Bloklash' : 'Ochish',
    });
    if (!ok) return;
    try {
      const res = await adminApi.setServiceBlocked(s.id, block);
      setData((data ?? []).map((x) => (x.id === s.id ? { ...x, is_blocked: res.is_blocked } : x)));
    } catch (e) {
      await dialog.error(e);
    }
  };

  if (loading) return <LoadingView />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if ((data ?? []).length === 0) return <EmptyState icon="pricetags-outline" title="Xizmatlar yo‘q" message="E’lon qilingan xizmatlar shu yerda moderatsiya qilinadi." />;

  return (
    <View style={{ gap: 12 }}>
      {(data ?? []).map((s) => (
        <Card key={s.id}>
          <Text style={typo.h3}>{s.name}</Text>
          <Text style={[typo.small, { marginTop: 3 }]}>
            {s.business.name} · {s.category?.name ?? 'Kategoriyasiz'} · {formatPrice(s.price)}
          </Text>
          <View style={styles.badges}>
            <Badge label={s.is_active ? 'Faol' : 'Nofaol'} tone={s.is_active ? 'success' : 'neutral'} />
            {s.is_blocked ? <Badge label="Bloklangan" tone="danger" /> : null}
          </View>
          <Button
            title={s.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}
            small
            variant={s.is_blocked ? 'primary' : 'secondary'}
            onPress={() => toggle(s)}
            style={{ marginTop: 12, alignSelf: 'flex-start' }}
          />
        </Card>
      ))}
    </View>
  );
}

const styles = makeStyles(() => ({
  badges: { flexDirection: 'row', gap: 6, marginTop: 10 },
}));
