import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Dimensions, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, typo, makeStyles } from '@/theme';

import { Icon } from './Icon';

/** Pastdan chiqadigan varaq (filtrlar, sharh yozish va h.k. uchun). */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(visible);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Keep the modal mounted before starting its entrance animation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() =>
        setMounted(false)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [Dimensions.get('window').height * 0.6, 0] });

  return (
    <Modal transparent visible={mounted} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={[typo.h2, styles.title]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}>
              <Icon name="close" size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = makeStyles(() => ({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { flex: 1, minWidth: 0, flexShrink: 1, marginRight: 12 },
  close: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
}));
