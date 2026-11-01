import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** A small border-drawn chevron that rotates smoothly between collapsed (▸) and expanded (▾). */
export function ChevronIcon({ expanded, color }: { expanded: boolean; color: string }) {
  const rotation = useSharedValue(expanded ? 225 : 45);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 225 : 45, { duration: 220 });
  }, [expanded, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return <Animated.View style={[styles.chevronIcon, { borderColor: color }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  chevronIcon: {
    width: 8,
    height: 8,
    marginTop: -3,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
});
