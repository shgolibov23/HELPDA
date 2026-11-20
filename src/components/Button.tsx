import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, gradients, radius, shadow, makeStyles } from '@/theme';

import { Icon } from './Icon';
import type { IconName } from './Icon';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'dark' | 'danger' | 'ghost';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, small, style }: Props) {
  const inactive = disabled || loading;
  const fg =
    variant === 'secondary' || variant === 'ghost' ? colors.text : variant === 'danger' ? colors.white : colors.white;

  const content = (
    <View style={[styles.row, small && styles.rowSmall]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.text, small && styles.textSmall, { color: fg }]}>{title}</Text>
        </>
      )}
    </View>
  );

  const container: StyleProp<ViewStyle> = [
    styles.base,
    variant === 'secondary' && styles.secondary,
    variant === 'ghost' && styles.ghost,
    variant === 'dark' && { backgroundColor: colors.black },
    variant === 'danger' && { backgroundColor: colors.danger },
    variant === 'primary' && shadow.float,
    inactive && { opacity: 0.55 },
    style,
  ];

  return (
    <PressableScale onPress={inactive ? undefined : onPress} disabled={inactive} style={container}>
      {variant === 'primary' ? (
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {content}
    </PressableScale>
  );
}

const styles = makeStyles(() => ({
  base: { borderRadius: radius.md, overflow: 'hidden', justifyContent: 'center' },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 12, minHeight: 52 },
  rowSmall: { paddingVertical: 9, paddingHorizontal: 14, minHeight: 38 },
  text: { flexShrink: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  textSmall: { fontSize: 14 },
}));
