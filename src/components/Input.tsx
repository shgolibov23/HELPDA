import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';

import { colors, radius, typo, makeStyles } from '@/theme';

import { Icon } from './Icon';
import type { IconName } from './Icon';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: IconName;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Input({ label, error, hint, icon, secureTextEntry, multiline, containerStyle, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isSecret = !!secureTextEntry;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          multiline && styles.fieldMulti,
          focused && styles.focused,
          !!error && styles.errored,
        ]}
      >
        {icon ? <Icon name={icon} size={18} color={focused ? colors.green : colors.placeholder} /> : null}
        <TextInput
          {...rest}
          multiline={multiline}
          secureTextEntry={isSecret && hidden}
          placeholderTextColor={colors.placeholder}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMulti, style]}
        />
        {isSecret ? (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = makeStyles(() => ({
  wrap: { marginBottom: 14 },
  label: { ...typo.label, marginBottom: 7 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  fieldMulti: { alignItems: 'flex-start', paddingTop: 12 },
  focused: { borderColor: colors.green },
  errored: { borderColor: colors.danger },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12 },
  inputMulti: { minHeight: 90, textAlignVertical: 'top', paddingTop: 0 },
  error: { color: colors.danger, fontSize: 12.5, fontWeight: '600', marginTop: 6 },
  hint: { ...typo.small, marginTop: 6 },
}));
