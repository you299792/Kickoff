import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/**
 * Wraps a screen's content and replays a fade + slide-up entrance every time
 * the screen is navigated to, not just on first mount. Expo Router's tab
 * slot keeps screens mounted after their first visit, so a plain
 * `entering={FadeIn...}` prop on an Animated.View only ever plays once —
 * every later visit snaps in instantly. Driving the animation from
 * useFocusEffect instead makes it replay consistently on every navigation.
 *
 * The animated opacity is applied to an inner layer only, on top of a
 * solid, theme-colored backdrop that is never transparent. Animating
 * opacity on the outer wrapper directly would briefly reveal whatever
 * sits behind it in the tree (an unstyled white view), flashing white
 * on every navigation.
 */
export function ScreenTransition({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const progress = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });

      return () => {
        // Reset (without animating) so the next focus always replays from the start.
        progress.value = 0;
      };
    }, [progress]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  return (
    <View style={[styles.backdrop, { backgroundColor: colors.background }, style]}>
      <Animated.View style={[styles.content, animatedStyle]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  content: { flex: 1 },
});
