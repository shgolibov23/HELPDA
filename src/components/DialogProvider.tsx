import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import { t } from '@/i18n';
import { colors, radius, shadow, typo, makeStyles } from '@/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import type { IconName } from './Icon';

type Tone = 'danger' | 'success' | 'info' | 'warning';

export type ConfirmOptions = {
  title: string;
  message?: string;
  icon?: IconName;
  tone?: Tone;
  confirmText?: string;
  cancelText?: string;
};
export type NotifyOptions = {
  title: string;
  message?: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  icon?: IconName;
  buttonText?: string;
};
export type PromptOptions = {
  title: string;
  message?: string;
  placeholder?: string;
  icon?: IconName;
  tone?: Tone;
  confirmText?: string;
  cancelText?: string;
  minLength?: number;
};

type Spec =
  | (Required<Pick<ConfirmOptions, 'title' | 'icon' | 'tone' | 'confirmText' | 'cancelText'>> & {
      kind: 'confirm';
      message?: string;
      resolve: (v: boolean) => void;
    })
  | {
      kind: 'notify';
      title: string;
      message?: string;
      icon: IconName;
      tone: Tone;
      buttonText: string;
      resolve: () => void;
    }
  | {
      kind: 'prompt';
      title: string;
      message?: string;
      placeholder?: string;
      icon: IconName;
      tone: Tone;
      confirmText: string;
      cancelText: string;
      minLength: number;
      resolve: (v: string | null) => void;
    };

type DialogApi = {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  notify: (o: NotifyOptions) => Promise<void>;
  prompt: (o: PromptOptions) => Promise<string | null>;
  error: (e: unknown, title?: string) => Promise<void>;
  showLoading: (text?: string) => void;
  hideLoading: () => void;
  withLoading: <T>(fn: () => Promise<T>, text?: string) => Promise<T>;
};

const DialogContext = createContext<DialogApi | null>(null);

const toneStyle = (): Record<Tone, { bg: string; fg: string }> => ({
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  success: { bg: colors.greenSoft, fg: colors.greenMid },
  info: { bg: colors.infoSoft, fg: colors.info },
  warning: { bg: colors.warningSoft, fg: colors.warning },
});

const notifyTone = { success: 'success', error: 'danger', info: 'info', warning: 'warning' } as const;
const notifyIcon: Record<'success' | 'error' | 'info' | 'warning', IconName> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
  warning: 'warning',
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Spec | null>(null);
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState<{ visible: boolean; text?: string }>({ visible: false });
  const currentRef = useRef<Spec | null>(null);
  const queue = useRef<Spec[]>([]);
  const [anim] = useState(() => new Animated.Value(0));
  const { width, height, fontScale } = useWindowDimensions();

  const present = useCallback(
    (spec: Spec) => {
      currentRef.current = spec;
      setText('');
      setTouched(false);
      anim.setValue(0);
      setCurrent(spec);
      Animated.timing(anim, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    },
    [anim]
  );

  const enqueue = useCallback(
    (spec: Spec) => {
      if (currentRef.current) queue.current.push(spec);
      else present(spec);
    },
    [present]
  );

  const close = useCallback(
    (done: () => void) => {
      Animated.timing(anim, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
        currentRef.current = null;
        setCurrent(null);
        done();
        const next = queue.current.shift();
        if (next) present(next);
      });
    },
    [anim, present]
  );

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (o) =>
        new Promise<boolean>((resolve) =>
          enqueue({
            kind: 'confirm',
            title: o.title,
            message: o.message,
            icon: o.icon ?? 'help-circle',
            tone: o.tone ?? 'info',
            confirmText: o.confirmText ?? t('confirm'),
            cancelText: o.cancelText ?? t('cancel'),
            resolve,
          })
        ),
      notify: (o) =>
        new Promise<void>((resolve) => {
          const type = o.type ?? 'info';
          enqueue({
            kind: 'notify',
            title: o.title,
            message: o.message,
            icon: o.icon ?? notifyIcon[type],
            tone: notifyTone[type],
            buttonText: o.buttonText ?? t('ok'),
            resolve,
          });
        }),
      prompt: (o) =>
        new Promise<string | null>((resolve) =>
          enqueue({
            kind: 'prompt',
            title: o.title,
            message: o.message,
            placeholder: o.placeholder,
            icon: o.icon ?? 'create-outline',
            tone: o.tone ?? 'info',
            confirmText: o.confirmText ?? t('confirm'),
            cancelText: o.cancelText ?? t('cancel'),
            minLength: o.minLength ?? 1,
            resolve,
          })
        ),
      error: (e, title) =>
        new Promise<void>((resolve) => {
          const network = e instanceof ApiError && e.isNetwork;
          enqueue({
            kind: 'notify',
            title: network ? t('networkTitle') : (title ?? t('errorTitle')),
            message: errorMessage(e),
            icon: network ? 'cloud-offline' : 'alert-circle',
            tone: 'danger',
            buttonText: t('ok'),
            resolve,
          });
        }),
      showLoading: (label) => setLoading({ visible: true, text: label }),
      hideLoading: () => setLoading({ visible: false }),
      withLoading: async (fn, label) => {
        setLoading({ visible: true, text: label });
        try {
          return await fn();
        } finally {
          setLoading({ visible: false });
        }
      },
    }),
    [enqueue]
  );

  const spec = current;

  const dismiss = () => {
    if (!spec) return;
    if (spec.kind === 'confirm') close(() => spec.resolve(false));
    else if (spec.kind === 'prompt') close(() => spec.resolve(null));
    else close(() => spec.resolve());
  };

  const accept = () => {
    if (!spec) return;
    if (spec.kind === 'confirm') close(() => spec.resolve(true));
    else if (spec.kind === 'notify') close(() => spec.resolve());
    else {
      const value = text.trim();
      if (value.length < spec.minLength) {
        setTouched(true);
        return;
      }
      close(() => spec.resolve(value));
    }
  };

  const tone = spec ? toneStyle()[spec.tone] : toneStyle().info;
  const stackActions = width < 380 || fontScale > 1.15;
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <DialogContext.Provider value={api}>
      {children}

      {loading.visible ? (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.green} />
            <Text style={[typo.bodyBold, { marginTop: 14 }]}>{loading.text ?? t('loading')}</Text>
          </View>
        </View>
      ) : null}

      <Modal transparent visible={!!spec} animationType="none" statusBarTranslucent onRequestClose={dismiss}>
        <Animated.View style={[styles.backdrop, { opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>
        <KeyboardAvoidingView
          style={[styles.center, { maxHeight: height }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          {spec ? (
            <Animated.View
              style={[
                styles.card,
                {
                  height: Math.min(height - 48, 420),
                  opacity: anim,
                  transform: [{ scale }, { translateY }],
                },
              ]}
            >
              <View style={[styles.content, { paddingBottom: stackActions ? 132 : 92 }]}>
                <ScrollView
                  style={styles.contentScroll}
                  contentContainerStyle={styles.contentInner}
                  scrollEnabled
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={[styles.iconCircle, { backgroundColor: tone.bg }]}>
                    <Icon name={spec.icon} size={30} color={tone.fg} />
                  </View>
                  <Text style={styles.title}>{spec.title}</Text>
                  {spec.message ? (
                    <Text style={[styles.message, { lineHeight: 22 * fontScale }]}>{spec.message}</Text>
                  ) : null}

                  {spec.kind === 'prompt' ? (
                    <View style={{ width: '100%', marginTop: 16 }}>
                      <TextInput
                        value={text}
                        onChangeText={setText}
                        placeholder={spec.placeholder}
                        placeholderTextColor={colors.placeholder}
                        multiline
                        autoFocus
                        style={[styles.input, touched && text.trim().length < spec.minLength && { borderColor: colors.danger }]}
                      />
                      {touched && text.trim().length < spec.minLength ? (
                        <Text style={styles.inputError}>Kamida {spec.minLength} ta belgi kiriting</Text>
                      ) : null}
                    </View>
                  ) : null}
                </ScrollView>
              </View>

              <View style={[styles.actions, stackActions && styles.actionsStack]}>
                {spec.kind === 'notify' ? (
                  <Button title={spec.buttonText} onPress={accept} style={styles.actionButton} />
                ) : (
                  <>
                    <Button title={spec.cancelText} variant="secondary" onPress={dismiss} style={styles.actionButton} />
                    <Button
                      title={spec.confirmText}
                      variant={spec.tone === 'danger' ? 'danger' : 'primary'}
                      onPress={accept}
                      style={styles.actionButton}
                    />
                  </>
                )}
              </View>
            </Animated.View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog faqat DialogProvider ichida ishlaydi');
  return ctx;
}

const styles = makeStyles(() => ({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  center: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    alignItems: 'center',
    flexDirection: 'column',
    flexShrink: 0,
    ...shadow.float,
  },
  content: { width: '100%', flex: 1, minHeight: 0 },
  contentScroll: { flex: 1, width: '100%', minHeight: 0 },
  contentInner: { alignItems: 'center', paddingBottom: 4 },
  iconCircle: { width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { ...typo.h2, fontSize: 20, textAlign: 'center', marginTop: 18, width: '100%', flexShrink: 1 },
  message: { ...typo.body, color: colors.muted, textAlign: 'center', marginTop: 8, width: '100%', flexShrink: 1 },
  actions: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    zIndex: 2,
    elevation: 4,
    flexDirection: 'row',
    gap: 10,
  },
  actionsStack: { flexDirection: 'column' },
  actionButton: { flex: 1, minWidth: 0 },
  input: {
    minHeight: 84,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  inputError: { color: colors.danger, fontSize: 12.5, fontWeight: '600', marginTop: 6 },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  loadingCard: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingVertical: 28, paddingHorizontal: 36, alignItems: 'center', ...shadow.float },
}));
