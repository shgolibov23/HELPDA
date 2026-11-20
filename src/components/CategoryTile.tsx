import { Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, makeStyles } from '@/theme';
import type { Category } from '@/types';

import { Icon } from './Icon';
import type { IconName } from './Icon';
import { PressableScale } from './PressableScale';

export function CategoryTile({
  category,
  onPress,
  selected,
  style,
}: {
  category: Category;
  onPress: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.94} style={[styles.tile, style]}>
      <View style={[styles.circle, selected && { backgroundColor: colors.black }]}>
        <Icon
          name={(category.icon ?? 'grid-outline') as IconName}
          size={24}
          color={selected ? colors.white : colors.greenMid}
        />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {category.name}
      </Text>
    </PressableScale>
  );
}

const styles = makeStyles(() => ({
  tile: { alignItems: 'center', gap: 8 },
  circle: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center', minHeight: 30 },
}));
