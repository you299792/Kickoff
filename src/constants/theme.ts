/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/** WCAG relative luminance of a hex color, 0 (black) to 1 (white). */
export function getColorLuminance(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;
  if (normalized.length !== 6) return 1;

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const toLinear = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** True for colors pale enough (e.g. white) to wash out against a light background. */
export function isPaleColor(hexColor: string): boolean {
  return getColorLuminance(hexColor) > 0.85;
}

/**
 * Picks a readable label color (near-black or white) for text/icons drawn on
 * top of a filled badge using an arbitrary team color.
 */
export function getContrastTextColor(hexColor: string): string {
  return getColorLuminance(hexColor) > 0.55 ? '#111827' : '#ffffff';
}

/** A subtle border so pale team colors (e.g. white) still read as a badge. */
export function getBadgeBorderColor(hexColor: string): string {
  return isPaleColor(hexColor) ? 'rgba(0, 0, 0, 0.18)' : 'transparent';
}

/**
 * For outline-style badges that use the team color directly as a border/text
 * color (not a fill), falls back to `fallbackColor` when the team color is
 * too pale to stay visible against the surrounding background.
 */
export function getAccentColor(hexColor: string, fallbackColor: string): string {
  return isPaleColor(hexColor) ? fallbackColor : hexColor;
}
