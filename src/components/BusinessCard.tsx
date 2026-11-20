import { StyleSheet, Text, View } from 'react-native';

import { colors, typo, makeStyles } from '@/theme';
import type { Business } from '@/types';

import { Avatar, Badge, Card } from './Card';
import { Icon } from './Icon';
import { Rating } from './Rating';

export function BusinessCard({ business, onPress, width }: { business: Business; onPress: () => void; width?: number }) {
  return (
    <Card onPress={onPress} style={width ? { width } : undefined}>
      <View style={styles.top}>
        <Avatar name={business.name} uri={business.logo} size={52} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={typo.h3} numberOfLines={1}>
            {business.name}
          </Text>
          <View style={styles.row}>
            <Icon name="location-outline" size={13} color={colors.muted} />
            <Text style={typo.small} numberOfLines={1}>
              {business.city ?? 'Manzil ko‘rsatilmagan'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.bottom}>
        <Rating value={business.rating} count={business.review_count} />
        <Text style={typo.small}>{business.services_count} ta xizmat</Text>
      </View>
      {business.is_featured ? (
        <View style={{ marginTop: 10 }}>
          <Badge label="Tavsiya etilgan" tone="success" icon="sparkles" />
        </View>
      ) : null}
    </Card>
  );
}

const styles = makeStyles(() => ({
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
}));
