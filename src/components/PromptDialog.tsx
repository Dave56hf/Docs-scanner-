import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Touchable } from './Pressable';
import { font, radius, space, useTheme } from '@/theme';

/** Single-field text prompt — used for naming and renaming documents. */
export function PromptDialog({
  visible,
  title,
  initialValue,
  placeholder,
  confirmLabel = 'Save',
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  initialValue: string;
  placeholder?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue);
  const [wasVisible, setWasVisible] = useState(visible);

  // Reopening the dialog should start from the current name, not the last edit.
  // Adjusting during render (rather than in an effect) avoids a wasted pass
  // that would briefly show the stale value.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setValue(initialValue);
  }

  const trimmed = value.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={[styles.backdrop, { backgroundColor: theme.overlay }]}
        onPress={onCancel}
      />
      <View style={styles.center} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[font.heading, { color: theme.text }]}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={theme.textFaint}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={() => trimmed && onSubmit(trimmed)}
            style={[
              font.body,
              styles.input,
              { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
            ]}
          />
          <View style={styles.actions}>
            <Touchable
              accessibilityRole="button"
              onPress={onCancel}
              style={styles.button}>
              <Text style={[font.label, { color: theme.textMuted }]}>Cancel</Text>
            </Touchable>
            <Touchable
              accessibilityRole="button"
              disabled={!trimmed}
              onPress={() => onSubmit(trimmed)}
              style={[
                styles.button,
                styles.confirm,
                { backgroundColor: trimmed ? theme.accent : theme.border },
              ]}>
              <Text style={[font.label, { color: trimmed ? theme.onAccent : theme.textFaint }]}>
                {confirmLabel}
              </Text>
            </Touchable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  button: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  confirm: { minWidth: 92, alignItems: 'center' },
});
