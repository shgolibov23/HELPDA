import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import { Avatar, Badge, Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Screen, ScreenHeader } from '@/components/Screen';
import { GuestPrompt } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { t } from '@/i18n';
import { colors, typo, makeStyles } from '@/theme';
import { formatPhone, roleLabel } from '@/utils/format';

function Row({ icon, label, onPress, danger, sub }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; sub?: string }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={styles.row}>
      <View style={[styles.rowIcon, danger && { backgroundColor: colors.dangerSoft }]}>
        <Icon name={icon} size={20} color={danger ? colors.danger : colors.greenMid} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typo.bodyBold, danger && { color: colors.danger }]}>{label}</Text>
        {sub ? <Text style={typo.small}>{sub}</Text> : null}
      </View>
      {!danger ? <Icon name="chevron-forward" size={18} color={colors.placeholder} /> : null}
    </PressableScale>
  );
}

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const dialog = useDialog();
  useRefetchOnFocus(() => {
    if (user) refreshUser();
  });

  const onLogout = async () => {
    const ok = await dialog.confirm({
      title: t('logoutTitle'),
      message: t('logoutMessage'),
      icon: 'log-out-outline',
      tone: 'danger',
      confirmText: t('logout'),
      cancelText: t('cancel'),
    });
    if (ok) {
      await logout();
      router.navigate('/');
    }
  };

  if (!user) {
    return (
      <Screen scroll={false} padded={false}>
        <ScreenHeader title={t('tabProfile')} back={false} />
        <GuestPrompt icon="person-circle-outline" title="HELPDA hisobi" message="Buyurtma berish, sevimlilarni saqlash va biznes ochish uchun tizimga kiring." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('tabProfile')} back={false} />
      <View style={{ padding: 16, gap: 16 }}>
        <Card style={styles.hero}>
          <Avatar name={user.full_name} uri={mediaUrl(user.avatar_url)} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={typo.h2} numberOfLines={1}>
              {user.full_name}
            </Text>
            <Text style={typo.small}>{formatPhone(user.phone)}</Text>
            {user.email ? <Text style={typo.small}>{user.email}</Text> : null}
            <Badge label={roleLabel(user.role)} tone={user.role === 'client' ? 'neutral' : 'success'} />
          </View>
        </Card>

        <Card style={{ padding: 6 }}>
          <Row icon="create-outline" label="Profilni tahrirlash" onPress={() => router.push('/edit-profile')} />
          {user.role === 'business' ? (
            <Row icon="storefront-outline" label="Biznes paneli" onPress={() => router.navigate('/dashboard')} />
          ) : null}
          {user.role === 'client' ? (
            <Row icon="business-outline" label="Biznes ochish" sub="MChJ, YTT yoki o‘zini o‘zi band qilgan" onPress={() => router.push('/business-apply')} />
          ) : null}
          {user.role !== 'admin' ? <Row icon="heart-outline" label={t('tabFavorites')} onPress={() => router.navigate('/favorites')} /> : null}
          <Row icon="receipt-outline" label="Mening buyurtmalarim" onPress={() => router.navigate('/orders')} />
          {user.role !== 'admin' ? <Row icon="megaphone-outline" label={user.role === 'client' ? 'Xizmat e’lonlarim' : 'Mijozlar so‘rovlari'} onPress={() => router.push('/service-requests')} /> : null}
          {user.role === 'client' ? <Row icon="sparkles-outline" label="AI xizmat topish" onPress={() => router.push('/smart-match')} /> : null}
          <Row icon="notifications-outline" label="Bildirishnomalar" onPress={() => router.push('/notifications')} />
          {user.role === 'client' ? <Row icon="ribbon-outline" label="Sodiqlik ballari" onPress={() => router.push('/loyalty')} /> : null}
          <Row icon="settings-outline" label="Sozlamalar" onPress={() => router.push('/settings')} />
        </Card>

        <Card style={{ padding: 6 }}>
          <Row icon="log-out-outline" label={t('logout')} danger onPress={onLogout} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  hero: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
}));
