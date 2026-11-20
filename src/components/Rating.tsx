import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, makeStyles } from '@/theme';

import { Icon } from './Icon';

export function Rating({ value, count, size = 13 }: { value: number | null; count?: number; size?: number }) {
  if (value === null) {
    return <Text style={[styles.none, { fontSize: size }]}>Baho yo‘q</Text>;
  }
  return (
    <View style={styles.row}>
      <Icon name="star" size={size + 1} color="#F2A900" />
      <Text style={[styles.value, { fontSize: size }]}>{value.toFixed(1)}</Text>
      {count !== undefined ? <Text style={[styles.count, { fontSize: size }]}>({count})</Text> : null}
    </View>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.picker}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Icon name={n <= value ? 'star' : 'star-outline'} size={36} color={n <= value ? '#F2A900' : colors.placeholder} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  value: { fontWeight: '800', color: colors.text },
  count: { color: colors.muted, fontWeight: '500' },
  none: { color: colors.muted, fontWeight: '500' },
  picker: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 },
}));
