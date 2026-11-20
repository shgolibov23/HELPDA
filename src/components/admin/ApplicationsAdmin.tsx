import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { API_URL } from '@/api/client';
import { adminApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Card, Chip, InfoBox } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { EmptyState, ErrorState, LoadingView } from '@/components/States';
import { ApplicationStatusBadge } from '@/components/StatusBadge';
import { useFetch } from '@/hooks/useFetch';
import { typo, makeStyles } from '@/theme';
import type { AdminApplication, ApplicationStatus } from '@/types';
import { businessTypeLabel, formatDate, formatPhone } from '@/utils/format';

const FILTERS: { key: ApplicationStatus; label: string }[] = [
  { key: 'pending', label: 'Kutilmoqda' },
  { key: 'approved', label: 'Tasdiqlangan' },
  { key: 'rejected', label: 'Rad etilgan' },
];

export function ApplicationsAdmin({ onChanged }: { onChanged: () => void }) {
  const dialog = useDialog();
  const [status, setStatus] = useState<ApplicationStatus>('pending');
  const { data, loading, error, reload } = useFetch(() => adminApi.applications(status), [status]);

  const approve = async (a: AdminApplication) => {
    const ok = await dialog.confirm({
      title: 'Arizani tasdiqlaysizmi?',
      message: `“${a.business_name}” tasdiqlansa, ${a.applicant_name} xizmat e’lon qila oladi. Bu faqat qo‘lda ko‘rib chiqish, davlat reyestri tekshiruvi emas.`,
      icon: 'checkmark-circle',
      tone: 'success',
      confirmText: 'Tasdiqlash',
    });
    if (!ok) return;
    try {
      await dialog.withLoading(() => adminApi.approve(a.id), 'Tasdiqlanmoqda...');
      await dialog.notify({ type: 'success', title: 'Ariza tasdiqlandi', message: `“${a.business_name}” endi xizmat e’lon qila oladi.` });
      reload();
      onChanged();
    } catch (e) {
      await dialog.error(e);
    }
  };

  const reject = async (a: AdminApplication) => {
    const reason = await dialog.prompt({
      title: 'Arizani rad etasizmi?',
      message: 'Rad etish sababini yozing. Ariza egasi uni ko‘radi.',
      placeholder: 'Masalan: STIR raqami noto‘g‘ri',
      icon: 'close-circle',
      tone: 'danger',
      confirmText: 'Rad etish',
      minLength: 5,
    });
    if (reason === null) return;
    try {
      await dialog.withLoading(() => adminApi.reject(a.id, reason), 'Rad etilmoqda...');
      await dialog.notify({ type: 'info', title: 'Ariza rad etildi', message: 'Sabab ariza egasiga ko‘rsatiladi.' });
      reload();
      onChanged();
    } catch (e) {
      await dialog.error(e);
    }
  };

  const openDocument = async (a: AdminApplication) => {
    try {
      const { url } = await adminApi.applicationDocumentLink(a.id);
      await Linking.openURL(`${API_URL}${url}`);
    } catch (e) {
      await dialog.error(e, 'Hujjat ochilmadi');
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>
      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon="documents-outline" title="Arizalar yo‘q" message="Bu bo‘limda hozircha ariza yo‘q." />
      ) : (
        (data ?? []).map((a) => (
          <Card key={a.id}>
            <View style={styles.row}>
              <Text style={[typo.h3, { flex: 1 }]}>{a.business_name}</Text>
              <ApplicationStatusBadge status={a.status} />
            </View>
            <View style={styles.lines}>
              <Line label="Shakl" value={businessTypeLabel(a.business_type)} />
              <Line label="STIR" value={a.registration_number} />
              <Line label="Biznes tel." value={formatPhone(a.business_phone)} />
              <Line label="Manzil" value={`${a.city}, ${a.address}`} />
              <Line label="Ariza egasi" value={`${a.applicant_name} (${formatPhone(a.applicant_phone)})`} />
              <Line label="Lavozimi" value={a.applicant_position} />
              <Line label="Yo‘nalishlar" value={a.categories.map((category) => category.name).join(', ') || '—'} />
              <Line label="Sana" value={formatDate(a.created_at)} />
              {a.rejection_reason ? <Line label="Rad sababi" value={a.rejection_reason} /> : null}
            </View>
            <Card style={styles.aiCard}>
              <Text style={typo.bodyBold}>AI tahlili: {aiLabel(a.ai_status, a.ai_recommendation)}</Text>
              {a.ai_confidence !== null ? <Text style={typo.small}>Ishonch: {Math.round(a.ai_confidence * 100)}%</Text> : null}
              {a.ai_summary ? <Text style={typo.body}>{a.ai_summary}</Text> : null}
              <Text style={typo.caption}>AI xulosa bermaydi va yakuniy qaror admin tomonidan qabul qilinadi.</Text>
            </Card>
            {a.document_available ? (
              <Button title="Maxfiy PDF hujjatni ochish" icon="document-text-outline" variant="secondary" small onPress={() => openDocument(a)} style={{ marginTop: 10 }} />
            ) : null}
            <InfoBox text={a.verification_note} icon="shield-outline" tone="warning" />
            {a.status === 'pending' ? (
              <View style={styles.actions}>
                <Button title="Tasdiqlash" icon="checkmark" small onPress={() => approve(a)} style={{ flex: 1 }} />
                <Button title="Rad etish" icon="close" variant="secondary" small onPress={() => reject(a)} style={{ flex: 1 }} />
              </View>
            ) : null}
          </Card>
        ))
      )}
    </View>
  );
}

function aiLabel(status: AdminApplication['ai_status'], recommendation: AdminApplication['ai_recommendation']) {
  if (status === 'pending') return 'tahlil qilinmoqda';
  if (status === 'not_configured') return 'sozlanmagan — qo‘lda tekshirish';
  if (status === 'failed') return 'bajarilmadi — qo‘lda tekshirish';
  if (recommendation === 'matches') return 'yo‘nalishga mos';
  if (recommendation === 'mismatch') return 'mos kelmasligi mumkin';
  return 'qo‘lda tekshirish tavsiya etiladi';
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={typo.small}>{label}</Text>
      <Text style={[typo.bodyBold, { flexShrink: 1, textAlign: 'right', fontSize: 14 }]}>{value}</Text>
    </View>
  );
}

const styles = makeStyles(() => ({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  lines: { gap: 6, marginVertical: 12 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  aiCard: { gap: 6, backgroundColor: '#F6F8F5', elevation: 0 },
}));
