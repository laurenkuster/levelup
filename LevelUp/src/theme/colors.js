export const colors = {
  background: '#1A1B26',
  header: '#161826',
  composerBg: '#101823',
  surface: '#111827',
  surfaceAlt: '#0f172a',

  accent: '#257bf4',
  accentStrong: '#3B82F6',
  accentSoft: 'rgba(37,123,244,0.12)',
  accentBorder: 'rgba(37,123,244,0.55)',
  accentOutline: 'rgba(37,123,244,0.45)',
  border: 'rgba(37,123,244,0.4)',
  borderSoft: 'rgba(37,123,244,0.35)',
  borderMuted: 'rgba(148,163,184,0.4)',

  /**
   * Text color/opacity hierarchy — use ONLY these for text.
   *
   * textPrimary   : White 90% — stat values, headers
   * textSecondary  : White 60% — body text, explanations, sublabels
   * textTertiary   : White 40% — timestamps, minor annotations
   *
   * Accent colors (green, cyan, red, yellow) ONLY for status indicators
   * and interactive elements, never for body text.
   */
  textPrimary: 'rgba(255,255,255,0.9)',
  textSecondary: 'rgba(255,255,255,0.6)',
  textTertiary: 'rgba(255,255,255,0.4)',

  /** Legacy aliases — prefer the hierarchy above for new code */
  textMuted: 'rgba(255,255,255,0.6)',
  textSoft: 'rgba(255,255,255,0.9)',
  textLabel: '#7aaef8',
  textLink: '#38bdf8',
  textChip: '#dbeafe',
  textTag: '#1f2937',
  textDark: '#0f172a',

  tagBg: '#93c5fd',
  success: '#22c55e',
  successBorder: 'rgba(34,197,94,0.7)',
  disabled: '#334155',
  error: '#f87171',
  errorBg: '#1f2937',
  errorBorder: 'rgba(248,113,113,0.35)',
  placeholder: '#64748b',
  skeleton: 'rgba(148,163,184,0.25)',
  skeletonSoft: 'rgba(148,163,184,0.2)',
};
