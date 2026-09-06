import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  /** Fires a selection tick before `onPress`. Off for destructive rows. */
  haptic?: boolean;
};

/**
 * Pressable with the app's standard press feedback so every tappable surface
 * dims by the same amount instead of each screen inventing its own.
 */
export function Touchable({ style, haptic = true, onPress, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      onPress={(event) => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(event);
      }}
      style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}
    />
  );
}
