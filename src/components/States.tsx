import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { colors, typo, makeStyles } from '@/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export function LoadingView({ text }: { text?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.green} />
      <Text style={[typo.small, { marginTop: 12 }]}>{text ?? t('loading')}</Text>
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={30} color={colors.greenMid} />
      </View>
      <Text style={[typo.h3, styles.title]}>{title}</Text>
      {message ? <Text style={[typo.small, styles.msg]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} small style={{ marginTop: 18 }} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
        <Icon name="cloud-offline-outline" size={30} color={colors.danger} />
      </View>
      <Text style={[typo.h3, styles.title]}>{t('errorTitle')}</Text>
      <Text style={[typo.small, styles.msg]}>{message}</Text>
      {onRetry ? <Button title={t('retry')} onPress={onRetry} variant="secondary" small style={{ marginTop: 18 }} /> : null}
    </View>
  );
}

/** Mehmon (tizimga kirmagan) foydalanuvchi uchun taklif. */
export function GuestPrompt({ icon, title, message }: { icon: IconName; title: string; message: string }) {
  return (
    <EmptyState icon={icon} title={title} message={message} actionLabel={t('login')} onAction={() => router.push('/auth')} />
  );
}

const styles = makeStyles(() => ({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 28 },
  iconCircle: { width: 68, height: 68, borderRadius: 24, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 16, textAlign: 'center' },
  msg: { marginTop: 6, textAlign: 'center', lineHeight: 19 },
}));
