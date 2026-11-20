import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { businessApi, catalogApi } from '@/api/endpoints';
import type { ApplicationInput } from '@/api/endpoints';
import type { MultipartFile } from '@/api/client';
import { Button } from '@/components/Button';
import { Card, Chip, InfoBox } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Input } from '@/components/Input';
import { PressableScale } from '@/components/PressableScale';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { ApplicationStatusBadge } from '@/components/StatusBadge';
import { ErrorState, GuestPrompt, LoadingView } from '@/components/States';
import { TelegramConnect } from '@/components/TelegramConnect';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { colors, radius, typo, makeStyles } from '@/theme';
import type { Application, BusinessType } from '@/types';
import { businessTypeLabel, formatDate, normalizePhone } from '@/utils/format';
import { goToTab } from '@/utils/nav';

const TYPES: { key: BusinessType; icon: IconName; hint: string }[] = [
  { key: 'mchj', icon: 'business-outline', hint: 'Mas’uliyati cheklangan jamiyat' },
  { key: 'ytt', icon: 'person-outline', hint: 'Yakka tartibdagi tadbirkor' },
  { key: 'self_employed', icon: 'briefcase-outline', hint: 'Rasman ro‘yxatdan o‘tgan o‘zini o‘zi band qilgan shaxs' },
];

type FormErrors = Partial<Record<keyof ApplicationInput, string>>;

export default function BusinessApplyScreen() {
  const { user, refreshUser } = useAuth();
  const dialog = useDialog();
  const app = useFetch(() => businessApi.myApplication(), [user?.id], !!user);
  const categoryData = useFetch(() => catalogApi.categories(), []);
  const [showForm, setShowForm] = useState(false);

  const [type, setType] = useState<BusinessType>('mchj');
  const [name, setName] = useState('');
  const [reg, setReg] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [position, setPosition] = useState('');
  const [description, setDescription] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [document, setDocument] = useState<MultipartFile | null>(null);
  const [documentError, setDocumentError] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const current: Application | null = app.data?.application ?? null;

  useEffect(() => {
    if (current?.status === 'approved' && user?.role === 'client') refreshUser();
  }, [current?.status, user?.role, refreshUser]);

  if (!user) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Biznes ochish" />
        <GuestPrompt icon="storefront-outline" title="Avval tizimga kiring" message="Biznes arizasini topshirish uchun hisob kerak." />
      </Screen>
    );
  }

  if (app.loading || categoryData.loading || app.error || categoryData.error) {
    return (
      <Screen edges={STACK_EDGES} padded={false} scroll={false}>
        <ScreenHeader title="Biznes ochish" />
        {app.loading || categoryData.loading ? (
          <LoadingView />
        ) : (
          <ErrorState message={app.error ?? categoryData.error ?? ''} onRetry={() => { app.reload(); categoryData.reload(); }} />
        )}
      </Screen>
    );
  }

  if (user.role === 'business' || current?.status === 'approved') {
    return (
      <Screen edges={STACK_EDGES} padded={false}>
        <ScreenHeader title="Biznes ochish" />
        <View style={{ padding: 16, gap: 16 }}>
          <Card>
            <View style={styles.statusHead}>
              <Icon name="checkmark-circle" size={28} color={colors.greenMid} />
              <Text style={typo.h3}>Biznesingiz tasdiqlangan</Text>
            </View>
            {current ? <Summary a={current} /> : null}
          </Card>
          <Button title="Biznes paneliga o‘tish" onPress={() => goToTab('/dashboard')} />
        </View>
      </Screen>
    );
  }

  if (current?.status === 'pending') {
    return (
      <Screen edges={STACK_EDGES} padded={false}>
        <ScreenHeader title="Biznes ochish" />
        <View style={{ padding: 16, gap: 16 }}>
          <Card>
            <View style={styles.statusHead}>
              <Icon name="time-outline" size={28} color={colors.warning} />
              <Text style={typo.h3}>Ariza ko‘rib chiqilmoqda</Text>
            </View>
            <Summary a={current} />
          </Card>
          <InfoBox text={current.verification_note} icon="shield-checkmark-outline" />
          <TelegramConnect />
          <Button title="Yangilash" variant="secondary" onPress={app.reload} />
        </View>
      </Screen>
    );
  }

  if (current?.status === 'rejected' && !showForm) {
    return (
      <Screen edges={STACK_EDGES} padded={false}>
        <ScreenHeader title="Biznes ochish" />
        <View style={{ padding: 16, gap: 16 }}>
          <Card>
            <View style={styles.statusHead}>
              <Icon name="close-circle" size={28} color={colors.danger} />
              <Text style={typo.h3}>Ariza rad etildi</Text>
            </View>
            <Text style={[typo.body, { color: colors.danger, marginTop: 10 }]}>Sabab: {current.rejection_reason ?? 'ko‘rsatilmagan'}</Text>
            <Summary a={current} />
          </Card>
          <Button title="Qayta topshirish" onPress={() => setShowForm(true)} />
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    if (documentError) return;
    const e: FormErrors = {};
    const normalized = normalizePhone(phone);
    if (name.trim().length < 2) e.business_name = 'Biznes nomini kiriting';
    if (reg.replace(/\s/g, '').length < 5) e.registration_number = 'STIR yoki ro‘yxat raqamini kiriting (kamida 5 ta belgi)';
    else if (!/^[A-Za-z0-9 ]+$/.test(reg)) e.registration_number = 'Faqat harf va raqamlar';
    if (!normalized) e.business_phone = 'Telefon raqami noto‘g‘ri. Namuna: 71 123 45 67';
    if (city.trim().length < 2) e.city = 'Shaharni kiriting';
    if (address.trim().length < 3) e.address = 'Manzilni kiriting';
    if (position.trim().length < 2) e.applicant_position = 'Lavozimingizni kiriting';
    if (categoryIds.length === 0) e.category_ids = 'Kamida bitta yo‘nalishni tanlang';
    if (description.trim().length < 20) e.description = 'Biznes haqida kamida 20 ta belgi yozing';
    setErrors(e);
    if (Object.keys(e).length || !normalized) return;

    const ok = await dialog.confirm({
      title: 'Arizani yuborasizmi?',
      message: 'Ma’lumotlar to‘g‘riligini tekshiring. Ariza admin tomonidan qo‘lda ko‘rib chiqiladi.',
      icon: 'document-text',
      tone: 'info',
      confirmText: 'Yuborish',
    });
    if (!ok) return;

    try {
      await dialog.withLoading(
        () =>
          businessApi.apply({
            business_type: type,
            business_name: name.trim(),
            registration_number: reg.replace(/\s/g, ''),
            business_phone: normalized,
            city: city.trim(),
            address: address.trim(),
            applicant_position: position.trim(),
            category_ids: categoryIds,
            description: description.trim(),
          }, document),
        'Ariza yuborilmoqda...'
      );
      await dialog.notify({
        type: 'success',
        title: 'Ariza yuborildi',
        message: 'Admin ma’lumotlaringizni ko‘rib chiqadi. Natija shu sahifada ko‘rinadi.',
      });
      setShowForm(false);
      app.reload();
    } catch (err) {
      await dialog.error(err, 'Ariza yuborilmadi');
    }
  };

  return (
    <Screen keyboard edges={STACK_EDGES} padded={false}>
      <ScreenHeader title="Biznes ochish" subtitle="Faqat rasman ro‘yxatdan o‘tgan biznes" />
      <View style={{ padding: 16 }}>
        <Text style={[typo.label, { marginBottom: 10 }]}>Huquqiy shakl</Text>
        <View style={{ gap: 10, marginBottom: 18 }}>
          {TYPES.map((tp) => (
            <PressableScale key={tp.key} onPress={() => setType(tp.key)} scaleTo={0.985} style={[styles.typeRow, type === tp.key && styles.typeOn]}>
              <View style={[styles.typeIcon, type === tp.key && { backgroundColor: colors.green }]}>
                <Icon name={tp.icon} size={20} color={type === tp.key ? colors.white : colors.greenMid} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typo.bodyBold}>{businessTypeLabel(tp.key)}</Text>
                <Text style={typo.small}>{tp.hint}</Text>
              </View>
              {type === tp.key ? <Icon name="checkmark-circle" size={22} color={colors.green} /> : null}
            </PressableScale>
          ))}
        </View>

        <Input label="Biznes nomi" icon="storefront-outline" value={name} onChangeText={setName} error={errors.business_name} />
        <Input label="STIR / ro‘yxat raqami" icon="document-text-outline" value={reg} onChangeText={setReg} error={errors.registration_number} autoCapitalize="characters" />
        <Input label="Biznes telefoni" icon="call-outline" value={phone} onChangeText={setPhone} error={errors.business_phone} keyboardType="phone-pad" />
        <Input label="Shahar" icon="location-outline" value={city} onChangeText={setCity} error={errors.city} />
        <Input label="Manzil" icon="map-outline" value={address} onChangeText={setAddress} error={errors.address} />
        <Input label="Sizning lavozimingiz / vakolatingiz" icon="id-card-outline" value={position} onChangeText={setPosition} error={errors.applicant_position} placeholder="Masalan: Direktor, Ta’sischi" />

        <Text style={[typo.label, { marginTop: 4, marginBottom: 10 }]}>Xizmat yo‘nalishlari</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: errors.category_ids ? 4 : 14 }}>
          {(categoryData.data ?? []).map((category) => {
            const selected = categoryIds.includes(category.id);
            return (
              <Chip
                key={category.id}
                label={category.name}
                selected={selected}
                onPress={() => setCategoryIds((items) =>
                  selected ? items.filter((id) => id !== category.id) : items.length < 8 ? [...items, category.id] : items
                )}
              />
            );
          })}
        </View>
        {errors.category_ids ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{errors.category_ids}</Text> : null}
        <Input
          label="Biznes haqida batafsil ma’lumot"
          value={description}
          onChangeText={setDescription}
          multiline
          error={errors.description}
          placeholder="Tajriba, xizmatlar, mijozlar va faoliyat haqida yozing"
        />
        <Button
          title={document ? `PDF: ${document.name}` : 'PDF hujjat tanlash (ixtiyoriy)'}
          icon="document-attach-outline"
          variant="secondary"
          small
          onPress={async () => {
            try {
              const picked = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
                multiple: false,
              });
              if (!picked.canceled) {
                const asset = picked.assets[0];
                if (asset.size !== undefined && asset.size > 10 * 1024 * 1024) {
                  setDocument(null);
                  setDocumentError('PDF hajmi 10 MB dan oshmasligi kerak.');
                  return;
                }
                setDocument({
                  uri: asset.uri,
                  name: asset.name,
                  type: asset.mimeType ?? 'application/pdf',
                  ...(asset.file ? { file: asset.file } : {}),
                });
                setDocumentError('');
              }
            } catch (err) {
              await dialog.error(err, 'PDF tanlanmadi');
            }
          }}
        />
        {document ? <Button title="PDFni olib tashlash" variant="ghost" small onPress={() => setDocument(null)} /> : null}
        {documentError ? <Text style={{ color: colors.danger, marginTop: 6 }}>{documentError}</Text> : null}
        <InfoBox text="PDF faqat adminlar va AI tahlili uchun maxfiy saqlanadi; mijozlarga ko‘rsatilmaydi." icon="lock-closed-outline" />

        <View style={{ marginBottom: 14 }}>
          <TelegramConnect />
        </View>
        <InfoBox
          text="Ariza admin tomonidan qo‘lda ko‘rib chiqiladi. Davlat reyestri bilan avtomatik tekshiruv hozircha mavjud emas, shuning uchun ma’lumotlarni aniq kiriting."
          icon="shield-checkmark-outline"
          tone="warning"
        />
        <Button title="Arizani yuborish" onPress={submit} style={{ marginTop: 16 }} />
        {current ? <Button title="Orqaga" variant="ghost" onPress={() => setShowForm(false)} /> : null}
      </View>
    </Screen>
  );
}

function Summary({ a }: { a: Application }) {
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      <Line label="Nomi" value={a.business_name} />
      <Line label="Shakl" value={businessTypeLabel(a.business_type)} />
      <Line label="STIR" value={a.registration_number} />
      <Line label="Manzil" value={`${a.city}, ${a.address}`} />
      <Line label="Yo‘nalishlar" value={a.categories.map((category) => category.name).join(', ') || '—'} />
      <Line label="Yuborilgan" value={formatDate(a.created_at)} />
      <View style={{ marginTop: 4 }}>
        <ApplicationStatusBadge status={a.status} />
      </View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={typo.small}>{label}</Text>
      <Text style={[typo.bodyBold, { flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

const styles = makeStyles(() => ({
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  typeOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  typeIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
}));
