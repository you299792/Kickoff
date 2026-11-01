import { forwardRef } from 'react';
import { Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale applied while pressed. Defaults to a subtle 0.96. */
  scaleTo?: number;
};

/**
 * Drop-in replacement for Pressable that animates scale + opacity smoothly
 * on press instead of snapping instantly, using reanimated so it stays on
 * the UI thread. The animated style is applied directly to the Pressable
 * itself (no wrapper View) so layout props like flex/width still work when
 * this sits inside a row of buttons.
 */
export const AnimatedPressable = forwardRef<View, AnimatedPressableProps>(
  function AnimatedPressable(
    { style, scaleTo = 0.96, onPressIn, onPressOut, children, ...props },
    ref,
  ) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }));

    return (
      <ReanimatedPressable
        ref={ref}
        {...props}
        onPressIn={(event) => {
          scale.value = withTiming(scaleTo, { duration: 110 });
          opacity.value = withTiming(0.8, { duration: 110 });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = withTiming(1, { duration: 180 });
          opacity.value = withTiming(1, { duration: 180 });
          onPressOut?.(event);
        }}
        style={[style, animatedStyle]}>
        {children}
      </ReanimatedPressable>
    );
  },
);
