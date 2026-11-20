import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { catalogApi } from '@/api/endpoints';
import { Card } from '@/components/Card';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { ErrorState, LoadingView } from '@/components/States';
import { useFetch } from '@/hooks/useFetch';
import { colors, typo } from '@/theme';
import { formatPrice } from '@/utils/format';

export default function CompareScreen() {
  const { ids: rawIds } = useLocalSearchParams<{ ids?: string }>();
  const ids = [...new Set((rawIds ?? '').split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 3);
  const { data, loading, error, reload } = useFetch(
    () => Promise.all(ids.map((id) => catalogApi.service(id))),
    [ids.join(',')],
    ids.length > 0
  );

  if (!ids.length) {
    return (
      <Screen edges={STACK_EDGES} padded={false}>
        <ScreenHeader title="Xizmatlarni solishtirish" />
        <Card style={{ margin: 16 }}>
          <Text style={typo.body}>Solishtirish uchun qidiruvda kamida bitta xizmat tanlang.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={STACK_EDGES} padded={false} scroll={false}>
      <ScreenHeader title="Xizmatlarni solishtirish" />
      {loading ? <LoadingView /> : error || !data ? <ErrorState message={error ?? 'Xizmatlar yuklanmadi'} onRetry={reload} /> : (
        <ScrollView horizontal contentContainerStyle={{ padding: 16, gap: 12 }} showsHorizontalScrollIndicator={false}>
          {data.map((service) => (
            <Card key={service.id} style={{ width: 260, alignSelf: 'flex-start' }} onPress={() => router.push(`/service/${service.id}`)}>
              <Text style={typo.h3}>{service.name}</Text>
              <Text style={[typo.body, { color: colors.muted, marginTop: 6 }]}>{service.business.name}</Text>
              <View style={{ gap: 12, marginTop: 18 }}>
                <CompareRow label="Narxi" value={formatPrice(service.price)} />
                <CompareRow label="Yo‘nalish" value={service.category?.name ?? 'Ko‘rsatilmagan'} />
                <CompareRow label="Shahar" value={service.business.city ?? 'Ko‘rsatilmagan'} />
                <CompareRow label="Reyting" value={service.rating === null ? 'Hali yo‘q' : `${service.rating} / 5`} />
                <CompareRow label="Sharhlar" value={String(service.review_count)} />
              </View>
              <Text style={[typo.caption, { marginTop: 18 }]}>Tafsilotlarni ko‘rish uchun bosing</Text>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function CompareRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={typo.caption}>{label}</Text>
      <Text style={typo.bodyBold}>{value}</Text>
    </View>
  );
}
