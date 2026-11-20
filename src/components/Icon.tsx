import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: ColorValue | null }) {
  const resolvedColor = typeof color === 'number' ? colors.text : color ?? colors.text;
  return <Ionicons name={name} size={size} color={resolvedColor} />;
}
