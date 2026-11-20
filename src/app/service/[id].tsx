import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { catalogApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Avatar, Badge, Card, InfoBox, SectionHeader } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Rating, StarPicker } from '@/components/Rating';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { ErrorState, LoadingView } from '@/components/States';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useFetch } from '@/hooks/useFetch';
import { t } from '@/i18n';
import { colors, gradients, radius, typo, makeStyles } from '@/theme';
import { formatDate, formatPhone, formatPrice } from '@/utils/format';

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const serviceId = Number(id);
  const { user } = useAuth();
  const dialog = useDialog();
  const toggleFavorite = useFavoriteToggle();

  const service = useFetch(() => catalogApi.service(serviceId), [serviceId, user?.id]);
  const reviews = useFetch(() => catalogApi.reviews(serviceId), [serviceId]);
  const eligibility = useFetch(() => catalogApi.eligibility(serviceId), [serviceId, user?.id], !!user);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  if (service.loading) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Xizmat" />
        <LoadingView />
      </Screen>
    );
  }
  const s = service.data;
  if (service.error || !s) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Xizmat" />
        <ErrorState message={service.error ?? t('unknownError')} onRetry={service.reload} />
      </Screen>
    );
  }

  const onFavorite = async () => {
    const value = await toggleFavorite(s);
    if (value !== null) service.setData({ ...s, is_favorite: value });
  };

  const order = async () => {
    if (!user) {
      const go = await dialog.confirm({
        title: t('loginRequiredTitle'),
        message: 'Buyurtma berish uchun tizimga kiring.',
        icon: 'log-in-outline',
        tone: 'info',
        confirmText: t('login'),
      });
      if (go) router.push('/auth');
      return;
    }
    router.push({ pathname: '/order/new', params: { serviceId: String(s.id) } });
  };

  const call = () =>
    Linking.openURL(`tel:+${s.business.phone}`).catch(() => dialog.notify({ type: 'error', title: 'Qo‘ng‘iroq qilib bo‘lmadi' }));
  const messageBusiness = () => {
    const url = `https://wa.me/${s.business.phone}?text=${encodeURIComponent(`Assalomu alaykum, ${s.name} xizmati haqida ma'lumot olmoqchiman.`)}`;
    Linking.openURL(url).catch(() => dialog.notify({ type: 'error', title: 'WhatsApp havolasi ochilmadi' }));
  };
  const submitReport = async () => {
    if (reportReason.trim().length < 8) {
      await dialog.notify({ type: 'error', title: 'Sababni kamida 8 ta belgida yozing' });
      return;
    }
    try {
      const result = await catalogApi.report({ service_id: s.id, reason: reportReason.trim() });
      setReportOpen(false);
      setReportReason('');
      await dialog.notify({ type: 'success', title: 'Shikoyat yuborildi', message: result.message });
    } catch (e) {
      await dialog.error(e);
    }
  };

  const submitReview = async () => {
    try {
      await dialog.withLoading(() => catalogApi.createReview(s.id, rating, comment.trim() || null), 'Yuborilmoqda...');
      setReviewOpen(false);
      setComment('');
      await dialog.notify({ type: 'success', title: 'Rahmat!', message: 'Sharhingiz qo‘shildi.' });
      service.silentReload();
      reviews.silentReload();
      eligibility.silentReload();
    } catch (e) {
      await dialog.error(e);
    }
  };

  const icon = (s.category?.icon ?? 'briefcase-outline') as IconName;
  const showImage = !!s.image_url && !imgFailed;

  return (
    <Screen
      edges={STACK_EDGES}
      padded={false}
      footer={
        <View style={styles.footer}>
          <View>
            <Text style={typo.caption}>Narxi</Text>
            <Text style={styles.price}>{formatPrice(s.price)}</Text>
          </View>
          <Button title="Buyurtma berish" icon="paper-plane-outline" onPress={order} style={{ flex: 1 }} />
        </View>
      }
    >
      <ScreenHeader
        title="Xizmat"
        right={
          <TouchableOpacity style={styles.heart} onPress={onFavorite} hitSlop={8}>
            <Icon name={s.is_favorite ? 'heart' : 'heart-outline'} size={22} color={s.is_favorite ? colors.danger : colors.text} />
          </TouchableOpacity>
        }
      />
      <View style={{ padding: 16, gap: 16 }}>
        <View style={styles.media}>
          {showImage ? (
            <Image source={{ uri: s.image_url! }} style={styles.mediaFill} onError={() => setImgFailed(true)} />
          ) : (
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mediaFill, styles.center]}>
              <Icon name={icon} size={56} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
          )}
        </View>

        <View style={{ gap: 8 }}>
          {s.category ? <Badge label={s.category.name} tone="success" /> : null}
          <Text style={typo.h1}>{s.name}</Text>
          <Rating value={s.rating} count={s.review_count} size={14} />
        </View>

        {s.description ? (
          <Card>
            <Text style={typo.h3}>Tavsif</Text>
            <Text style={[typo.body, { marginTop: 8, color: colors.muted }]}>{s.description}</Text>
          </Card>
        ) : null}

        <Card onPress={() => router.push(`/company/${s.business.id}`)}>
          <View style={styles.bizRow}>
            <Avatar name={s.business.name} uri={s.business.logo} size={52} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={typo.h3} numberOfLines={1}>
                {s.business.name}
              </Text>
              <Text style={typo.small} numberOfLines={1}>
                {[s.business.city, s.business.address].filter(Boolean).join(', ') || 'Manzil ko‘rsatilmagan'}
              </Text>
              <Badge label={t('manualReviewBadge')} tone="info" icon="shield-checkmark-outline" />
            </View>
            <Icon name="chevron-forward" size={18} color={colors.placeholder} />
          </View>
          <View style={styles.contact}>
            <Icon name="call-outline" size={16} color={colors.muted} />
            <Text style={typo.bodyBold}>{formatPhone(s.business.phone)}</Text>
            <View style={{ flex: 1 }} />
            <Button title={t('call')} small variant="secondary" onPress={call} />
            <Button title="WhatsApp" small variant="secondary" onPress={messageBusiness} />
          </View>
        </Card>

        <InfoBox text={t('noPaymentNote')} icon="card-outline" tone="warning" />
        {user?.role === 'client' ? (
          <Button title="Xizmat haqida shikoyat" icon="flag-outline" variant="ghost" onPress={() => setReportOpen(true)} />
        ) : null}

        <View>
          <SectionHeader title={`Sharhlar (${s.review_count})`} />
          {eligibility.data?.can_review ? (
            <Button title="Sharh qoldirish" icon="star-outline" variant="secondary" onPress={() => setReviewOpen(true)} style={{ marginBottom: 12 }} />
          ) : null}
          {(reviews.data ?? []).length === 0 ? (
            <Text style={typo.small}>Hozircha sharhlar yo‘q. Sharhni xizmat buyurtmasi yakunlangandan so‘ng qoldirish mumkin.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {(reviews.data ?? []).map((r) => (
                <Card key={r.id}>
                  <View style={styles.reviewHead}>
                    <Text style={typo.bodyBold}>{r.user_name}</Text>
                    <Text style={typo.caption}>{formatDate(r.created_at)}</Text>
                  </View>
                  <Rating value={r.rating} />
                  {r.comment ? <Text style={[typo.body, { marginTop: 6, color: colors.muted }]}>{r.comment}</Text> : null}
                  {r.business_response ? <Text style={[typo.body, { marginTop: 8, color: colors.greenMid }]}>Biznes javobi: {r.business_response}</Text> : null}
                </Card>
              ))}
            </View>
          )}
        </View>
      </View>

      <Sheet visible={reviewOpen} onClose={() => setReviewOpen(false)} title="Sharh qoldirish">
        <StarPicker value={rating} onChange={setRating} />
        <Input label="Fikringiz (ixtiyoriy)" value={comment} onChangeText={setComment} multiline placeholder="Xizmat sifati qanday edi?" />
        <Button title="Yuborish" onPress={submitReview} />
      </Sheet>
      <Sheet visible={reportOpen} onClose={() => setReportOpen(false)} title="Shikoyat yuborish">
        <Text style={[typo.body, { color: colors.muted, marginBottom: 12 }]}>Shikoyatni adminlar ko‘rib chiqadi. Sababni aniq yozing.</Text>
        <Input label="Shikoyat sababi" value={reportReason} onChangeText={setReportReason} multiline maxLength={1000} placeholder="Muammoni tushuntiring..." />
        <Button title="Yuborish" onPress={submitReport} />
      </Sheet>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  media: { height: 190, borderRadius: radius.lg, overflow: 'hidden' },
  mediaFill: { width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  heart: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  bizRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  price: { fontSize: 18, fontWeight: '900', color: colors.text },
}));
