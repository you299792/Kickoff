import { Tabs, TabList, TabSlot, TabTrigger, TabTriggerSlotProps } from 'expo-router/ui';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

export default function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot style={styles.tabSlot} />
      <TabList asChild>
        <View
          style={StyleSheet.flatten([
            styles.tabBar,
            { height: 72 + insets.bottom, paddingBottom: Spacing.two + insets.bottom },
          ])}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon={require('@/assets/images/tabIcons/home.png')} label="Home" />
          </TabTrigger>
          <TabTrigger name="teams" href="/teams" asChild>
            <TabButton icon={require('@/assets/images/tabIcons/explore.png')} label="Teams" />
          </TabTrigger>
          <TabTrigger name="new-match" href="/new-match" style={styles.hiddenRoute} />
          <TabTrigger name="create-team" href="/create-team" style={styles.hiddenRoute} />
          <TabTrigger name="live-match" href="/live-match" style={styles.hiddenRoute} />
          <TabTrigger name="match-details" href="/match-details" style={styles.hiddenRoute} />
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  icon,
  label,
  isFocused,
  ...props
}: Omit<TabTriggerSlotProps, 'ref'> & { icon: number; label: string }) {
  return (
    <Pressable
      {...props}
      accessibilityLabel={label}
      accessibilityRole="tab"
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <Image source={icon} style={[styles.icon, isFocused ? styles.iconActive : styles.iconInactive]} />
      <View style={[styles.activeMark, isFocused && styles.activeMarkVisible]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabSlot: {
    flex: 1,
  },
  tabBar: {
    height: 72,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.two,
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2e3135',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#121417',
  },
  tabButton: {
    flex: 1,
    maxWidth: 120,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  icon: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  iconActive: {
    tintColor: '#ffffff',
  },
  iconInactive: {
    tintColor: '#8f98a3',
  },
  activeMark: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  activeMarkVisible: {
    backgroundColor: '#1f7a4d',
  },
  pressed: {
    opacity: 0.55,
  },
  hiddenRoute: {
    display: 'none',
  },
});
