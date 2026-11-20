import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';

import { colors, spacing, typo, makeStyles } from '@/theme';

import { Icon } from './Icon';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  keyboard?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  background?: string;
};

/** Bottom tab ichidagi ekranlar uchun odatiy `edges` (pastki qismni tab bar o'zi hal qiladi). */
export const STACK_EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top', 'left', 'right'],
  keyboard = false,
  refreshing,
  onRefresh,
  footer,
  contentStyle,
  background = colors.bg,
}: Props) {
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.green} colors={[colors.green]} />
        ) : undefined
      }
      contentContainerStyle={[padded && { padding: spacing.lg }, { paddingBottom: spacing.xxxl }, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && { padding: spacing.lg }, contentStyle]}>{children}</View>
  );

  const inner = (
    <>
      {body}
      {footer}
    </>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: background }]}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  back = true,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {back ? (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
        >
          <Icon name="chevron-back" size={22} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.flex}>
        <Text style={typo.h2} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={typo.small}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = makeStyles(() => ({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
