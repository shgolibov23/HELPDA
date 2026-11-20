import { Text, View } from 'react-native';

import { adminApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { ErrorState, LoadingView } from '@/components/States';
import { useFetch } from '@/hooks/useFetch';
import { colors, radius, typo, makeStyles } from '@/theme';
import { formatDate } from '@/utils/format';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={typo.caption}>{label}</Text>
    </View>
  );
}

export function ReportsAdmin({ refreshKey }: { refreshKey: number }) {
  const dialog = useDialog();
  const { data, loading, error, reload } = useFetch(() => adminApi.stats(), [refreshKey]);
  const reports = useFetch(() => adminApi.reports(), [refreshKey]);
  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={reload} />;

  const resolve = async (id: number, status: 'resolved' | 'dismissed') => {
    try {
      await dialog.withLoading(() => adminApi.resolveReport(id, status), 'Saqlanmoqda...');
      await reports.silentReload();
    } catch (e) {
      await dialog.error(e);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.grid}>
        <Stat label="Foydalanuvchilar" value={data.users} />
        <Stat label="Bizneslar" value={data.businesses} />
        <Stat label="Xizmatlar" value={data.services} />
        <Stat label="Bloklangan xizmat" value={data.blocked_services} />
        <Stat label="Sharhlar" value={data.reviews} />
        <Stat label="Buyurtmalar (30 kun)" value={data.orders_last_30_days} />
      </View>
      <Card>
        <Text style={typo.h3}>Biznes arizalari</Text>
        <View style={styles.grid}>
          <Stat label="Kutilmoqda" value={data.applications.pending} />
          <Stat label="Tasdiqlangan" value={data.applications.approved} />
          <Stat label="Rad etilgan" value={data.applications.rejected} />
        </View>
      </Card>
      <Card>
        <Text style={typo.h3}>Buyurtmalar</Text>
        <View style={styles.grid}>
          <Stat label="Yangi" value={data.orders.pending} />
          <Stat label="Qabul qilingan" value={data.orders.accepted} />
          <Stat label="Rad etilgan" value={data.orders.rejected} />
          <Stat label="Yakunlangan" value={data.orders.completed} />
          <Stat label="Bekor qilingan" value={data.orders.cancelled} />
        </View>
      </Card>
      <View style={{ gap: 10 }}>
        <Text style={typo.h3}>Kutilayotgan shikoyatlar ({reports.data?.length ?? 0})</Text>
        {reports.loading ? <LoadingView /> : reports.error ? <ErrorState message={reports.error} onRetry={reports.reload} /> : null}
        {!reports.loading && !reports.error && reports.data?.length === 0 ? (
          <Text style={typo.small}>Ko‘rib chiqiladigan shikoyatlar yo‘q.</Text>
        ) : null}
        {reports.data?.map((report) => (
          <Card key={report.id}>
            <Text style={typo.bodyBold}>{report.service_name ?? report.business_name ?? 'O‘chirilgan obyekt'}</Text>
            <Text style={typo.small}>Yuboruvchi: {report.reporter_name} · {formatDate(report.created_at)}</Text>
            <Text style={[typo.body, { marginTop: 6 }]}>{report.reason}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              <Button title="Yopish" small onPress={() => resolve(report.id, 'resolved')} />
              <Button title="Rad etish" small variant="secondary" onPress={() => resolve(report.id, 'dismissed')} />
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  stat: { flexGrow: 1, flexBasis: '30%', backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, gap: 2 },
  value: { fontSize: 24, fontWeight: '900', color: colors.text },
}));
