/** Shared presentation bits, so the screens stay about the crypto. */

import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

export const theme = {
  bg: '#0e1513',
  card: '#17211f',
  line: '#243330',
  text: '#dce5e2',
  dim: '#7b8c88',
  accent: '#57bfad',
  bad: '#d2705c',
  mono: 'Courier',
};

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={s.note}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  kind = 'normal',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  kind?: 'normal' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        kind === 'primary' && s.buttonPrimary,
        kind === 'danger' && s.buttonDanger,
        (pressed || disabled) && s.buttonMuted,
      ]}
    >
      <Text
        style={[
          s.buttonText,
          kind === 'primary' && s.buttonTextPrimary,
          kind === 'danger' && s.buttonTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={s.row}>{children}</View>;
}

/** A label with a monospace value underneath — public keys, ciphertext, byte counts. */
export function Mono({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={s.mono}>
      <Text style={s.monoLabel}>
        {label}
        {onPress ? '  (tap to copy)' : ''}
      </Text>
      <Text style={s.monoValue} selectable>
        {value}
      </Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.dim}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      style={[s.input, props.multiline && s.inputMultiline, props.style]}
    />
  );
}

/** Success or failure of the last action. Errors show the CryptoError code. */
export function Status({ ok, message }: { ok: boolean; message: string }) {
  return (
    <View style={[s.status, ok ? s.statusOk : s.statusBad]}>
      <Text style={[s.statusText, !ok && s.statusTextBad]}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.line,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  note: { color: theme.dim, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  button: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.line,
  },
  buttonPrimary: { borderColor: theme.accent, backgroundColor: '#16302c' },
  buttonDanger: { borderColor: theme.bad },
  buttonMuted: { opacity: 0.45 },
  buttonText: { color: theme.text, fontSize: 13 },
  buttonTextPrimary: { color: theme.accent, fontWeight: '600' },
  buttonTextDanger: { color: theme.bad },
  mono: { marginTop: 10 },
  monoLabel: {
    color: theme.dim,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  monoValue: {
    color: theme.text,
    fontFamily: theme.mono,
    fontSize: 12,
    marginTop: 3,
  },
  input: {
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 7,
    color: theme.text,
    fontSize: 13,
    padding: 10,
    marginTop: 8,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  status: {
    marginTop: 10,
    padding: 9,
    borderRadius: 7,
    backgroundColor: '#16302c',
  },
  statusOk: {},
  statusBad: { backgroundColor: '#2e1c18' },
  statusText: { color: theme.accent, fontSize: 12, fontFamily: theme.mono },
  statusTextBad: { color: theme.bad },
});
