import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Moderate-scale helper: blends a fixed size with a screen-proportional size.
 * factor 0 = fully fixed, factor 1 = fully proportional (to 390pt reference).
 */
const REF_WIDTH = 390; // iPhone 14 baseline
const ms = (size, factor = 0.35) => {
  const scaled = (SCREEN_W / REF_WIDTH) * size;
  return Math.round(size + (scaled - size) * factor);
};

export const typography = {
  family: {
    pixel: 'PressStart2P',
    mono: 'VT323',
  },
  size: {
    xs: ms(9),        // minimum readable PressStart2P
    sm: ms(10),
    md: ms(12),
    base: ms(16),
    lg: ms(18),
    xl: ms(20),
    xxl: ms(24),
  },
  lineHeight: {
    tight: 1.2,       // pixel-font headings
    normal: 1.5,      // body text (VT323)
    relaxed: 1.6,     // long-form / descriptions
  },
};

/** 8-point spacing scale */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};
