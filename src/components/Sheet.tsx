import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Touchable } from './Pressable';
import { font, radius, space, useTheme } from '@/theme';

export type SheetAction = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  destructive?: boolean;
  onPress: () => void;
};

/** Bottom sheet of actions — the app's one menu affordance. */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={[styles.backdrop, { backgroundColor: theme.overlay }]}
        onPress={onClose}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.surface,
            paddingBottom: insets.bottom + space.lg,
          },
        ]}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <Text style={[font.heading, styles.title, { color: theme.textMuted }]}>{title}</Text>
        <ScrollView bounces={false}>
          {actions.map((action) => (
            <Touchable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              haptic={!action.destructive}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={styles.row}>
              <View
                style={[
                  styles.rowIcon,
                  { backgroundColor: action.destructive ? theme.dangerSoft : theme.accentSoft },
                ]}>
                <Ionicons
                  name={action.icon}
                  size={19}
                  color={action.destructive ? theme.danger : theme.accent}
                />
              </View>
              <View style={styles.rowText}>
                <Text
                  style={[font.body, { color: action.destructive ? theme.danger : theme.text }]}>
                  {action.label}
                </Text>
                {!!action.hint && (
                  <Text style={[font.caption, { color: theme.textFaint }]}>{action.hint}</Text>
                )}
              </View>
            </Touchable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    maxHeight: '75%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: space.md,
  },
  title: { marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
});
