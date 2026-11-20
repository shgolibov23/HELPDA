import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, gradients, radius, shadow, typo, makeStyles } from '@/theme';
import type { Service } from '@/types';
import { formatPrice } from '@/utils/format';

import { Icon } from './Icon';
import type { IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Rating } from './Rating';

type Props = {
  service: Service;
  onPress: () => void;
  onToggleFavorite?: () => void;
  width?: number;
};

export function ServiceCard({ service, onPress, onToggleFavorite, width }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const icon = (service.category?.icon ?? 'briefcase-outline') as IconName;
  const showImage = !!service.image_url && !imgFailed;

  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={[styles.card, width ? { width } : null]}>
      <View style={styles.media}>
        {showImage ? (
          <Image source={{ uri: service.image_url! }} style={styles.image} onError={() => setImgFailed(true)} />
        ) : (
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.image}>
            <Icon name={icon} size={38} color="rgba(255,255,255,0.9)" />
          </LinearGradient>
        )}
        {onToggleFavorite ? (
          <TouchableOpacity style={styles.heart} onPress={onToggleFavorite} hitSlop={8}>
            <Icon
              name={service.is_favorite ? 'heart' : 'heart-outline'}
              size={18}
              color={service.is_favorite ? colors.danger : colors.text}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.body}>
        {service.category ? <Text style={styles.category}>{service.category.name}</Text> : null}
        <Text style={styles.name} numberOfLines={2}>
          {service.name}
        </Text>
        <View style={styles.bizRow}>
          <Icon name="storefront-outline" size={13} color={colors.muted} />
          <Text style={styles.biz} numberOfLines={1}>
            {service.business.name}
            {service.business.city ? ` · ${service.business.city}` : ''}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.price}>{formatPrice(service.price)}</Text>
          <Rating value={service.rating} count={service.review_count} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = makeStyles(() => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  media: { height: 120 },
  image: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  heart: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 14, gap: 4 },
  category: { fontSize: 11.5, fontWeight: '800', color: colors.greenMid, textTransform: 'uppercase', letterSpacing: 0.4 },
  name: { ...typo.h3, minHeight: 22 },
  bizRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  biz: { ...typo.small, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  price: { fontSize: 15, fontWeight: '800', color: colors.text },
}));
