import { router } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { View } from 'react-native';

import { mediaUrl } from '@/api/client';
import type { MultipartFile } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { Avatar, Card } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Input } from '@/components/Input';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';
import { formatPhone, isValidEmail } from '@/utils/format';

export default function EditProfileScreen() {
  const { user, setUser } = useAuth();
  const dialog = useDialog();
  const [name, setName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  if (!user) return null;

  const save = async () => {
    const e: typeof errors = {};
    if (name.trim().length < 3) e.name = 'Ism kamida 3 ta belgidan iborat bo‘lsin';
    if (email.trim() && !isValidEmail(email)) e.email = 'Email manzili noto‘g‘ri';
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const updated = await dialog.withLoading(
        () => authApi.updateMe({ full_name: name.trim(), email: email.trim() || null }),
        'Saqlanmoqda...'
      );
      setUser(updated);
      await dialog.notify({ type: 'success', title: 'Saqlandi', message: 'Profil ma’lumotlari yangilandi.' });
      router.back();
    } catch (err) {
      await dialog.error(err);
    }
  };

  const choosePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const image: MultipartFile = {
        uri: asset.uri,
        name: asset.fileName ?? 'profile.jpg',
        type: asset.mimeType ?? 'image/jpeg',
        ...(asset.file ? { file: asset.file } : {}),
      };
      setUploadingPhoto(true);
      const updated = await dialog.withLoading(() => authApi.uploadAvatar(image), 'Rasm yuklanmoqda...');
      setUser(updated);
      await dialog.notify({ type: 'success', title: 'Rasm yangilandi' });
    } catch (err) {
      await dialog.error(err, 'Rasm yuklanmadi');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <Screen keyboard edges={STACK_EDGES} padded={false}>
      <ScreenHeader title="Profilni tahrirlash" />
      <View style={{ padding: 16 }}>
        <Card style={{ alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Avatar name={user.full_name} uri={mediaUrl(user.avatar_url)} size={88} />
          <Button
            title={user.avatar_url ? 'Rasmni almashtirish' : 'Profil rasmi qo‘yish'}
            icon="image-outline"
            variant="secondary"
            small
            loading={uploadingPhoto}
            onPress={choosePhoto}
          />
        </Card>
        <Input label="To‘liq ism" icon="person-outline" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
        <Input label="Email (ixtiyoriy)" icon="mail-outline" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Telefon raqami" icon="call-outline" value={formatPhone(user.phone)} editable={false} hint="Telefon raqamini o‘zgartirib bo‘lmaydi" />
        <Button title={t('save')} onPress={save} style={{ marginTop: 8 }} />
      </View>
    </Screen>
  );
}
