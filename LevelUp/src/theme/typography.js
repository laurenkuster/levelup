import { Dimensions } from 'react-native';

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

  /**
   * Font scale — use ONLY these sizes. Nothing else.
   *
   * xxl : Stat hero numbers (energy score "75", countdown timers)
   * xl  : Section values ("1790", "100%", "8h")
   * lg  : Section headers ("RECOVERY BREAKDOWN", "FOOD ANALYTICS")
   * md  : Body text, status labels, insight text
   * sm  : Sublabels ("KCAL TODAY", "LAST NIGHT", XP progress)
   * xs  : Tertiary info, timestamps, minor annotations
   */
  size: {
    xs: ms(9),
    sm: ms(10),
    md: ms(12),
    lg: ms(16),
    xl: ms(20),
    xxl: ms(28),
  },

  lineHeight: {
    hero: 1.0,    // hero numbers only (xxl stat values, countdown timers)
    normal: 1.5,  // everything else — body, labels, headers
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

  /** Value-to-its-own-label gap: tight pair */
  valueLabelGap: 2,
  /** Between adjacent stat pairs in a row */
  statPairGap: 16,
  /** Card internal padding */
  cardPadding: 16,
};
