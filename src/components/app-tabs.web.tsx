import { Tabs, TabList, TabSlot, TabTrigger, TabTriggerSlotProps } from 'expo-router/ui';
import { Image, Pressable, StyleSheet, View } from 'react-native';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.tabSlot} />
      <TabList asChild>
        <View style={styles.tabBar}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon={require('@/assets/images/tabIcons/home.png')} label="Home" />
          </TabTrigger>
          <TabTrigger name="teams" href="/teams" asChild>
            <TabButton icon={require('@/assets/images/tabIcons/explore.png')} label="Teams" />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ icon, label, isFocused, ...props }: TabTriggerSlotProps & { icon: number; label: string }) {
  return (
    <Pressable
      {...props}
      aria-label={label}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <Image source={icon} style={[styles.icon, isFocused ? styles.iconActive : styles.iconInactive]} />
      <View style={[styles.activeMark, isFocused && styles.activeMarkVisible]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabSlot: {
    height: '100%',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 72,
    paddingHorizontal: 80,
    paddingTop: 4,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2e3135',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#121417',
  },
  tabButton: {
    flex: 1,
    maxWidth: 120,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
});