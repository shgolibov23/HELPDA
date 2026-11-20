import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '@/components/Button';
import { Card, Chip } from '@/components/Card';
import { useDialog } from '@/components/DialogProvider';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Screen, STACK_EDGES } from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';
import { colors, gradients, typo, makeStyles } from '@/theme';
import { isValidEmail, normalizePhone } from '@/utils/format';

type Errors = Partial<Record<'name' | 'phone' | 'email' | 'password', string>>;

export default function AuthScreen() {
  const { login, register } = useAuth();
  const dialog = useDialog();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [wantsBusiness, setWantsBusiness] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const validate = (): string | null => {
    const e: Errors = {};
    const normalized = normalizePhone(phone);
    if (isRegister && name.trim().length < 3) e.name = 'Ism kamida 3 ta belgidan iborat bo‘lsin';
    if (!normalized) e.phone = 'Telefon raqami noto‘g‘ri. Namuna: 90 123 45 67';
    if (isRegister && email.trim() && !isValidEmail(email)) e.email = 'Email manzili noto‘g‘ri';
    if (isRegister ? password.length < 8 : password.length < 1)
      e.password = isRegister ? 'Parol kamida 8 ta belgidan iborat bo‘lsin' : 'Parolni kiriting';
    setErrors(e);
    return Object.keys(e).length === 0 ? normalized : null;
  };

  const submit = async () => {
    const normalized = validate();
    if (!normalized) return;
    setBusy(true);
    try {
      if (isRegister) {
        await register({
          full_name: name.trim(),
          phone: normalized,
          email: email.trim() || undefined,
          password,
        });
        if (wantsBusiness) router.replace('/business-apply');
        else router.back();
      } else {
        await login(normalized, password);
        router.back();
      }
    } catch (e) {
      await dialog.error(e, isRegister ? 'Ro‘yxatdan o‘tib bo‘lmadi' : 'Kirib bo‘lmadi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen keyboard edges={STACK_EDGES} padded={false} contentStyle={{ paddingBottom: 40 }}>
      <LinearGradient colors={gradients.dark} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <TouchableOpacity style={styles.close} onPress={() => router.back()} hitSlop={10}>
          <Icon name="close" size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.logo}>
          <Text style={styles.logoText}>H</Text>
        </View>
        <Text style={styles.brand}>{t('appName')}</Text>
        <Text style={styles.slogan}>{t('slogan')}</Text>
      </LinearGradient>

      <View style={styles.formWrap}>
        <Card style={{ padding: 20 }}>
          <View style={styles.switch}>
            <Chip label={t('login')} selected={!isRegister} onPress={() => { setMode('login'); setErrors({}); }} />
            <Chip label={t('register')} selected={isRegister} onPress={() => { setMode('register'); setErrors({}); }} />
          </View>

          {isRegister ? (
            <>
              <Text style={styles.roleLabel}>Siz kimsiz?</Text>
              <View style={styles.roles}>
                <Chip label="Mijoz — xizmat qidiraman" icon="search-outline" selected={!wantsBusiness} onPress={() => setWantsBusiness(false)} />
                <Chip label="Biznes — xizmat taklif qilaman" icon="storefront-outline" selected={wantsBusiness} onPress={() => setWantsBusiness(true)} />
              </View>
              {wantsBusiness ? (
                <Text style={[typo.small, { marginBottom: 14 }]}>
                  Avval hisob yaratiladi, so‘ng biznesingizni ro‘yxatdan o‘tkazish arizasini to‘ldirasiz.
                </Text>
              ) : null}
              <Input label="To‘liq ism" icon="person-outline" value={name} onChangeText={setName} error={errors.name} placeholder="Ali Valiyev" autoCapitalize="words" />
            </>
          ) : null}

          <Input
            label="Telefon raqami"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
            placeholder="90 123 45 67"
            keyboardType="phone-pad"
            hint="+998 avtomatik qo‘shiladi"
          />
          {isRegister ? (
            <Input label="Email (ixtiyoriy)" icon="mail-outline" value={email} onChangeText={setEmail} error={errors.email} placeholder="ali@example.com" keyboardType="email-address" autoCapitalize="none" />
          ) : null}
          <Input label="Parol" icon="lock-closed-outline" value={password} onChangeText={setPassword} error={errors.password} placeholder="••••••••" secureTextEntry autoCapitalize="none" />

          <Button title={isRegister ? t('register') : t('login')} onPress={submit} loading={busy} style={{ marginTop: 6 }} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  hero: { paddingTop: 56, paddingBottom: 70, alignItems: 'center', borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  close: { position: 'absolute', top: 16, right: 16, width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 68, height: 68, borderRadius: 24, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.white, fontSize: 34, fontWeight: '900' },
  brand: { color: colors.white, fontSize: 30, fontWeight: '900', letterSpacing: 2, marginTop: 14 },
  slogan: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4, fontWeight: '500' },
  formWrap: { paddingHorizontal: 16, marginTop: -44 },
  switch: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  roleLabel: { ...typo.label, marginBottom: 8 },
  roles: { gap: 8, marginBottom: 12, alignItems: 'flex-start' },
}));
