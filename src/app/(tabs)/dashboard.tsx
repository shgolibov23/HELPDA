import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { businessApi } from '@/api/endpoints';
import { BusinessOrders } from '@/components/BusinessOrders';
import { BusinessServices } from '@/components/BusinessServices';
import { Avatar, Badge, Card, Chip } from '@/components/Card';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Rating } from '@/components/Rating';
import { Screen, ScreenHeader } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { t } from '@/i18n';
import { colors, radius, typo, makeStyles } from '@/theme';
import { formatPrice } from '@/utils/format';

function Stat({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={20} color={colors.greenMid} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={typo.caption}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'services' | 'orders'>('services');
  const isBusiness = user?.role === 'business';
  const me = useFetch(() => businessApi.me(), [user?.id], isBusiness);

  if (!isBusiness) {
    return (
      <Screen scroll={false} padded={false}>
        <ScreenHeader title={t('tabBusiness')} back={false} />
        <EmptyState icon="storefront-outline" title="Biznes paneli yopiq" message="Panel faqat tasdiqlangan biznes egalari uchun." actionLabel="Biznes ochish" onAction={() => router.push('/business-apply')} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={me.refreshing} onRefresh={me.refresh} padded={false}>
      <ScreenHeader title="Biznes paneli" back={false} />
      <View style={{ padding: 16, gap: 16 }}>
        {me.loading ? (
          <LoadingView />
        ) : me.error || !me.data ? (
          <ErrorState message={me.error ?? ''} onRetry={me.reload} />
        ) : (
          <>
            <Card>
              <View style={styles.head}>
                <Avatar name={me.data.business.name} uri={me.data.business.logo} size={56} />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={typo.h3} numberOfLines={1}>
                    {me.data.business.name}
                  </Text>
                  <Rating value={me.data.business.rating} count={me.data.business.review_count} />
                  <Badge label={t('manualReviewBadge')} tone="info" icon="shield-checkmark-outline" />
                </View>
              </View>
              <View style={styles.headActions}>
                <Button title="Profilni tahrirlash" icon="create-outline" variant="secondary" small onPress={() => router.push('/business-edit')} />
                <Button title="Ommaviy ko‘rinish" icon="eye-outline" variant="ghost" small onPress={() => router.push(`/company/${me.data!.business.id}`)} />
              </View>
            </Card>

            <View style={styles.stats}>
              <Stat icon="pricetags-outline" label="Jami xizmat" value={me.data.stats.total_services} />
              <Stat icon="flash-outline" label="Faol" value={me.data.stats.active_services} />
              <Stat icon="mail-unread-outline" label="Yangi buyurtma" value={me.data.stats.orders.pending} />
              <Stat icon="ribbon-outline" label="Yakunlangan" value={me.data.stats.orders.completed} />
            </View>
            <Card>
              <Text style={typo.h3}>So‘nggi 30 kun</Text>
              <View style={styles.stats}>
                <Stat icon="receipt-outline" label="Buyurtmalar" value={me.data.stats.orders_last_30_days} />
                <Stat icon="checkmark-circle-outline" label="Yakunlangan" value={me.data.stats.completed_last_30_days} />
              </View>
              <Text style={[typo.bodyBold, { marginTop: 10 }]}>Tushum: {formatPrice(me.data.stats.revenue_last_30_days)}</Text>
            </Card>
          </>
        )}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Xizmatlarim" icon="pricetags-outline" selected={tab === 'services'} onPress={() => setTab('services')} />
          <Chip label="Buyurtmalar" icon="receipt-outline" selected={tab === 'orders'} onPress={() => setTab('orders')} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button title="Mijozlar so‘rovi" icon="megaphone-outline" variant="secondary" small onPress={() => router.push('/service-requests')} />
          <Button title="Bo‘sh vaqt va kuponlar" icon="calendar-outline" variant="secondary" small onPress={() => router.push('/business-tools')} />
        </View>

        {tab === 'services' ? <BusinessServices onChanged={me.silentReload} /> : <BusinessOrders onChanged={me.silentReload} />}
      </View>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headActions: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4 },
  statValue: { fontSize: 26, fontWeight: '900', color: colors.text },
}));
