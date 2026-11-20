import { router, useLocalSearchParams } from 'expo-router';
import { Image, Linking, ScrollView, Text, View } from 'react-native';

import { businessApi, catalogApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Avatar, Badge, Card, Chip, InfoBox, SectionHeader } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Rating } from '@/components/Rating';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { ServiceCard } from '@/components/ServiceCard';
import { ErrorState, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useFetch } from '@/hooks/useFetch';
import { t } from '@/i18n';
import { colors, typo, makeStyles } from '@/theme';
import type { Service } from '@/types';
import { businessTypeLabel, formatDate, formatPhone } from '@/utils/format';
import { useState } from 'react';

export default function CompanyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const dialog = useDialog();
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const toggleFavorite = useFavoriteToggle();
  const { data, loading, error, reload, setData } = useFetch(() => catalogApi.business(Number(id)), [id, user?.id]);
  const ownBusiness = useFetch(() => businessApi.me(), [user?.id], user?.role === 'business');

  if (loading || error || !data) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Biznes" />
        {loading ? <LoadingView /> : <ErrorState message={error ?? t('unknownError')} onRetry={reload} />}
      </Screen>
    );
  }
  const { business: b, services, reviews } = data;

  const onFavorite = async (s: Service) => {
    const value = await toggleFavorite(s);
    if (value !== null) setData({ ...data, services: services.map((x) => (x.id === s.id ? { ...x, is_favorite: value } : x)) });
  };

  const call = () =>
    Linking.openURL(`tel:+${b.phone}`).catch(() => dialog.notify({ type: 'error', title: 'Qo‘ng‘iroq qilib bo‘lmadi' }));
  const messageBusiness = () => {
    const url = `https://wa.me/${b.phone}?text=${encodeURIComponent(`Assalomu alaykum, ${b.name} haqida ma'lumot olmoqchiman.`)}`;
    Linking.openURL(url).catch(() => dialog.notify({ type: 'error', title: 'WhatsApp havolasi ochilmadi' }));
  };
  const submitReport = async () => {
    if (reportReason.trim().length < 8) {
      await dialog.notify({ type: 'error', title: 'Sababni kamida 8 ta belgida yozing' });
      return;
    }
    try {
      const result = await catalogApi.report({ business_id: b.id, reason: reportReason.trim() });
      setReportOpen(false);
      setReportReason('');
      await dialog.notify({ type: 'success', title: 'Shikoyat yuborildi', message: result.message });
    } catch (e) {
      await dialog.error(e);
    }
  };
  const openMaps = () =>
    b.maps_url && Linking.openURL(b.maps_url).catch(() => dialog.notify({ type: 'error', title: 'Xarita havolasi ochilmadi' }));
  const submitReply = async (reviewId: number, currentReply: string | null) => {
    const response = (replyDrafts[reviewId] ?? currentReply ?? '').trim();
    if (response.length < 2) {
      await dialog.notify({ type: 'error', title: 'Javob kamida 2 ta belgidan iborat bo‘lsin' });
      return;
    }
    try {
      await dialog.withLoading(() => businessApi.replyToReview(reviewId, response), 'Javob saqlanmoqda...');
      setReplyDrafts((drafts) => ({ ...drafts, [reviewId]: response }));
      await reload();
      await dialog.notify({ type: 'success', title: 'Javob saqlandi' });
    } catch (e) {
      await dialog.error(e);
    }
  };
  const canReply = user?.role === 'business' && ownBusiness.data?.business.id === b.id;

  return (
    <Screen edges={STACK_EDGES} padded={false}>
      <ScreenHeader title="Biznes profili" />
      <View style={{ padding: 16, gap: 16 }}>
        <Card>
          <View style={styles.head}>
            <Avatar name={b.name} uri={b.logo} size={70} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={typo.h2}>{b.name}</Text>
              <Rating value={b.rating} count={b.review_count} size={14} />
              {b.business_type ? <Badge label={businessTypeLabel(b.business_type)} tone="neutral" /> : null}
            </View>
          </View>
          {b.description ? <Text style={[typo.body, { color: colors.muted, marginTop: 14 }]}>{b.description}</Text> : null}
          {b.categories.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {b.categories.map((category) => <Chip key={category.id} label={category.name} />)}
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Icon name="location-outline" size={18} color={colors.muted} />
            <Text style={[typo.body, { flex: 1 }]}>{[b.city, b.address].filter(Boolean).join(', ') || 'Manzil ko‘rsatilmagan'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="call-outline" size={18} color={colors.muted} />
            <Text style={[typo.body, { flex: 1 }]}>{formatPhone(b.phone)}</Text>
          </View>
          {b.working_hours ? (
            <View style={styles.infoRow}>
              <Icon name="time-outline" size={18} color={colors.muted} />
              <Text style={[typo.body, { flex: 1 }]}>{b.working_hours}</Text>
            </View>
          ) : null}
          <Button title={t('call')} icon="call-outline" onPress={call} style={{ marginTop: 14 }} />
          <Button title="WhatsApp orqali yozish" icon="chatbubble-outline" variant="secondary" onPress={messageBusiness} style={{ marginTop: 8 }} />
          {b.maps_url ? <Button title="Xaritada ko‘rish" icon="map-outline" variant="secondary" onPress={openMaps} style={{ marginTop: 8 }} /> : null}
          {user?.role === 'client' ? (
            <Button title="Biznes haqida shikoyat" icon="flag-outline" variant="ghost" onPress={() => setReportOpen(true)} style={{ marginTop: 8 }} />
          ) : null}
        </Card>

        {b.portfolio_images.length ? (
          <View>
            <SectionHeader title="Portfolio" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {b.portfolio_images.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.portfolioImage} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <InfoBox text={t('manualReviewNote')} icon="shield-checkmark-outline" />

        <View>
          <SectionHeader title={`Xizmatlar (${services.length})`} />
          {services.length === 0 ? (
            <Text style={typo.small}>Hozircha faol xizmatlar yo‘q.</Text>
          ) : (
            <View style={{ gap: 14 }}>
              {services.map((s) => (
                <ServiceCard key={s.id} service={s} onPress={() => router.push(`/service/${s.id}`)} onToggleFavorite={() => onFavorite(s)} />
              ))}
            </View>
          )}
        </View>

        <View>
          <SectionHeader title={`Sharhlar (${b.review_count})`} />
          {reviews.length === 0 ? (
            <Text style={typo.small}>Hozircha sharhlar yo‘q.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {reviews.map((r) => (
                <Card key={r.id}>
                  <View style={styles.reviewHead}>
                    <Text style={typo.bodyBold}>{r.user_name}</Text>
                    <Text style={typo.caption}>{formatDate(r.created_at)}</Text>
                  </View>
                  <Rating value={r.rating} />
                  {r.comment ? <Text style={[typo.body, { marginTop: 6, color: colors.muted }]}>{r.comment}</Text> : null}
                  {r.business_response ? (
                    <View style={styles.reply}>
                      <Text style={typo.bodyBold}>Biznes javobi</Text>
                      <Text style={[typo.body, { color: colors.muted }]}>{r.business_response}</Text>
                    </View>
                  ) : null}
                  {canReply ? (
                    <View style={{ marginTop: 10 }}>
                      <Input
                        label="Biznes javobi"
                        value={replyDrafts[r.id] ?? r.business_response ?? ''}
                        onChangeText={(value) => setReplyDrafts((drafts) => ({ ...drafts, [r.id]: value }))}
                        multiline
                        placeholder="Mijozga javob yozing"
                      />
                      <Button title={r.business_response ? 'Javobni yangilash' : 'Javob berish'} small onPress={() => submitReply(r.id, r.business_response)} />
                    </View>
                  ) : null}
                </Card>
              ))}
            </View>
          )}
        </View>
      </View>
      <Sheet visible={reportOpen} onClose={() => setReportOpen(false)} title="Shikoyat yuborish">
        <Text style={[typo.body, { color: colors.muted, marginBottom: 12 }]}>Shikoyatni adminlar ko‘rib chiqadi. Sababni aniq yozing.</Text>
        <Input label="Shikoyat sababi" value={reportReason} onChangeText={setReportReason} multiline maxLength={1000} placeholder="Muammoni tushuntiring..." />
        <Button title="Yuborish" onPress={submitReport} />
      </Sheet>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12 },
  portfolioImage: { width: 220, height: 150, borderRadius: 16, backgroundColor: colors.surface },
  reply: { marginTop: 10, padding: 10, gap: 4, borderRadius: 12, backgroundColor: colors.surface },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
}));
