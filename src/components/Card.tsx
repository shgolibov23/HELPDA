import { Image, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useState } from 'react';

import { colors, radius, shadow, typo, makeStyles } from '@/theme';

import { Icon } from './Icon';
import type { IconName } from './Icon';
import { PressableScale } from './PressableScale';

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.985} style={[styles.card, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.95} style={[styles.chip, selected && styles.chipOn]}>
      {icon ? <Icon name={icon} size={15} color={selected ? colors.white : colors.muted} /> : null}
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </PressableScale>
  );
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneColors = (): Record<Tone, { bg: string; fg: string }> => ({
  success: { bg: colors.greenSoft, fg: colors.greenMid },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: colors.neutralSoft, fg: colors.muted },
});

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = toneColors()[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <Icon name={icon} size={12} color={c.fg} /> : null}
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, uri, size = 48 }: { name: string; uri?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 3 }}
      />
    );
  }
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 3 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={typo.h3}>{title}</Text>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} scaleTo={0.95}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function InfoBox({ text, icon = 'information-circle-outline', tone = 'info' }: { text: string; icon?: IconName; tone?: Tone }) {
  const c = toneColors()[tone];
  return (
    <View style={[styles.info, { backgroundColor: c.bg }]}>
      <Icon name={icon} size={18} color={c.fg} />
      <Text style={[styles.infoText, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

const styles = makeStyles(() => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadow.card,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.black, borderColor: colors.black },
  chipText: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  avatar: { backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.greenMid, fontWeight: '800' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionAction: { color: colors.greenMid, fontWeight: '700', fontSize: 13.5 },
  info: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
}));
