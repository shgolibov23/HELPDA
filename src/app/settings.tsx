import { StyleSheet, Text, View } from 'react-native';

import { API_URL } from '@/api/client';
import { Badge, Card, Chip, InfoBox } from '@/components/Card';
import { Screen, ScreenHeader, STACK_EDGES } from '@/components/Screen';
import { useTheme } from '@/context/ThemeContext';
import type { ThemePref } from '@/context/ThemeContext';
import { t } from '@/i18n';
import { typo, makeStyles } from '@/theme';

const THEMES: { key: ThemePref; label: string; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline' }[] = [
  { key: 'system', label: 'Tizim', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Yorug‘', icon: 'sunny-outline' },
  { key: 'dark', label: 'Qorong‘i', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { pref, setPref } = useTheme();
  return (
    <Screen edges={STACK_EDGES} padded={false}>
      <ScreenHeader title="Sozlamalar" />
      <View style={{ padding: 16, gap: 16 }}>
        <Card>
          <Text style={typo.h3}>Mavzu</Text>
          <View style={styles.row}>
            {THEMES.map((th) => (
              <Chip key={th.key} label={th.label} icon={th.icon} selected={pref === th.key} onPress={() => setPref(th.key)} />
            ))}
          </View>
          <Text style={[typo.small, { marginTop: 10 }]}>“Tizim” telefon sozlamasiga moslashadi.</Text>
        </Card>

        <Card>
          <Text style={typo.h3}>Til</Text>
          <View style={styles.row}>
            <Chip label="O‘zbekcha" selected />
            <Chip label={`Русский · ${t('soon')}`} />
            <Chip label={`English · ${t('soon')}`} />
          </View>
          <Text style={[typo.small, { marginTop: 10 }]}>Boshqa tillar uchun tarjima tizimi tayyor, matnlar keyinroq qo‘shiladi.</Text>
        </Card>

        <Card>
          <Text style={typo.h3}>To‘lovlar</Text>
          <View style={{ marginTop: 10 }}>
            <InfoBox text={t('noPaymentNote')} icon="card-outline" tone="warning" />
          </View>
        </Card>

        <Card>
          <Text style={typo.h3}>Ilova haqida</Text>
          <View style={styles.info}>
            <Text style={typo.small}>Versiya</Text>
            <Badge label="2.0.0" />
          </View>
          <View style={styles.info}>
            <Text style={typo.small}>Server manzili</Text>
            <Text style={[typo.caption, { flexShrink: 1 }]}>{API_URL}</Text>
          </View>
          <Text style={[typo.small, { marginTop: 10 }]}>{t('slogan')}</Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  info: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 12 },
}));
