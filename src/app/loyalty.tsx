import { Text, View } from 'react-native';

import { ordersApi } from '@/api/endpoints';
import { Card } from '@/components/Card';
import { Screen, ScreenHeader } from '@/components/Screen';
import { ErrorState, GuestPrompt, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { colors, typo } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';

export default function LoyaltyScreen() {
  const { user } = useAuth();
  const { data, loading, error, reload, refresh, refreshing } = useFetch(() => ordersApi.loyalty(), [user?.id], !!user);
  if (!user) {
    return (
      <Screen padded={false}>
        <ScreenHeader title="Sodiqlik ballari" />
        <GuestPrompt icon="ribbon-outline" title="Sodiqlik dasturi" message="Ballaringizni ko‘rish uchun tizimga kiring." />
      </Screen>
    );
  }
  return (
    <Screen padded={false} refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Sodiqlik ballari" back={false} />
      <View style={{ padding: 16, gap: 12 }}>
        {loading ? <LoadingView /> : error ? <ErrorState message={error} onRetry={reload} /> : null}
        {data ? (
          <>
            <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
              <Text style={[typo.caption, { color: colors.muted }]}>Mavjud ballar</Text>
              <Text style={{ color: colors.greenMid, fontSize: 44, fontWeight: '900', marginVertical: 4 }}>{data.points}</Text>
              <Text style={typo.bodyBold}>Taxminiy qiymati: {formatPrice(data.points * data.point_value_uzs)}</Text>
              <Text style={[typo.small, { textAlign: 'center', marginTop: 8 }]}>{data.earn_rule} Ballar buyurtma narxining 20%igacha ishlatiladi.</Text>
            </Card>
            <Text style={typo.h3}>Ballar tarixi</Text>
            {!data.transactions.length ? <Text style={typo.small}>Yakunlangan buyurtmalardan keyin ballar qo‘shiladi.</Text> : null}
            {data.transactions.map((transaction) => (
              <Card key={transaction.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={typo.bodyBold}>
                    {transaction.kind === 'earn' ? 'Buyurtma bonusi' : transaction.kind === 'redeem' ? 'Buyurtmada ishlatildi' : 'Bekor qilingan buyurtma qaytarimi'}
                  </Text>
                  <Text style={[typo.bodyBold, { color: transaction.points >= 0 ? colors.greenMid : colors.danger }]}>
                    {transaction.points > 0 ? '+' : ''}{transaction.points}
                  </Text>
                </View>
                <Text style={[typo.caption, { marginTop: 4 }]}>{formatDate(transaction.created_at)}{transaction.order_id ? ` · Buyurtma #${transaction.order_id}` : ''}</Text>
              </Card>
            ))}
          </>
        ) : null}
      </View>
    </Screen>
  );
}
