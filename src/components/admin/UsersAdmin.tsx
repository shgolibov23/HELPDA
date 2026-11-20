import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { adminApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Avatar, Badge, Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Input } from '@/components/Input';
import { EmptyState, ErrorState, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useFetch } from '@/hooks/useFetch';
import { typo, makeStyles } from '@/theme';
import type { AdminUser } from '@/types';
import { formatPhone, roleLabel } from '@/utils/format';

export function UsersAdmin() {
  const dialog = useDialog();
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const { data, loading, error, reload, setData } = useFetch(() => adminApi.users(dq.trim() || undefined), [dq]);

  const toggle = async (u: AdminUser) => {
    const block = u.is_active;
    const ok = await dialog.confirm({
      title: block ? 'Foydalanuvchini bloklaysizmi?' : 'Blokdan chiqarasizmi?',
      message: block ? `${u.full_name} tizimga kira olmaydi.` : `${u.full_name} yana tizimga kira oladi.`,
      icon: block ? 'ban' : 'lock-open',
      tone: block ? 'danger' : 'success',
      confirmText: block ? 'Bloklash' : 'Faollashtirish',
    });
    if (!ok || !data) return;
    try {
      const res = await adminApi.setUserActive(u.id, !u.is_active);
      setData({ ...data, items: data.items.map((x) => (x.id === u.id ? { ...x, is_active: res.is_active } : x)) });
    } catch (e) {
      await dialog.error(e);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Input icon="search-outline" placeholder="Ism yoki telefon bo‘yicha qidirish" value={q} onChangeText={setQ} containerStyle={{ marginBottom: 0 }} />
      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState icon="people-outline" title="Foydalanuvchi topilmadi" />
      ) : (
        <>
          <Text style={typo.small}>Jami: {data?.total}</Text>
          {(data?.items ?? []).map((u) => (
            <Card key={u.id}>
              <View style={styles.row}>
                <Avatar name={u.full_name} size={44} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={typo.bodyBold}>{u.full_name}</Text>
                  <Text style={typo.small}>{formatPhone(u.phone)}</Text>
                  <View style={styles.badges}>
                    <Badge label={roleLabel(u.role)} tone={u.role === 'client' ? 'neutral' : 'success'} />
                    {!u.is_active ? <Badge label="Bloklangan" tone="danger" /> : null}
                  </View>
                </View>
                {u.id !== me?.id ? (
                  <Button title={u.is_active ? 'Bloklash' : 'Ochish'} small variant={u.is_active ? 'secondary' : 'primary'} onPress={() => toggle(u)} />
                ) : null}
              </View>
            </Card>
          ))}
        </>
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
}));
