import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography, spacing } from '../../theme/typography';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.header },
  headerTitle: { color: colors.accentStrong, fontSize: typography.size.lg, fontFamily: typography.family.pixel, lineHeight: typography.size.lg * typography.lineHeight.normal },
  content: { padding: spacing.base, paddingBottom: 100, gap: spacing.base },

  /* Tabs */
  tabBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, maxHeight: 44 },
  tabBarContent: { paddingHorizontal: spacing.sm },
  tab: { paddingVertical: spacing.md, paddingHorizontal: spacing.base, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accentStrong },
  tabText: { color: colors.textTertiary, fontFamily: typography.family.pixel, fontSize: typography.size.xs, lineHeight: typography.size.xs * typography.lineHeight.normal },
  tabTextActive: { color: colors.accentStrong },

  /* Panels */
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.base, gap: spacing.sm },
  centerPanel: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  sect: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.sm, letterSpacing: 1, lineHeight: typography.size.sm * typography.lineHeight.normal },

  loadingText: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.lg, lineHeight: typography.size.lg * typography.lineHeight.normal },
  noTitle: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.md, marginTop: spacing.sm, lineHeight: typography.size.md * typography.lineHeight.normal },
  noText: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: typography.size.lg * typography.lineHeight.normal },
  cta: { marginTop: spacing.sm, backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 4 },
  ctaT: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm, lineHeight: typography.size.sm * typography.lineHeight.normal },

  /* Score */
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, marginTop: spacing.xs },
  bigScore: { fontSize: typography.size.xxl, fontFamily: typography.family.pixel, lineHeight: typography.size.xxl * typography.lineHeight.hero },
  energyLabel: { fontFamily: typography.family.pixel, fontSize: typography.size.sm, lineHeight: typography.size.sm * typography.lineHeight.normal },
  desc: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, lineHeight: typography.size.lg * typography.lineHeight.normal },
  bar: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, overflow: 'hidden', marginTop: spacing.xs },
  barFill: { height: '100%', borderRadius: 3 },
  energyCard: { borderColor: colors.accentBorder },

  /* Badge */
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.valueLabelGap },
  badgeText: { fontFamily: typography.family.pixel, fontSize: typography.size.xs, lineHeight: typography.size.xs * typography.lineHeight.normal },

  /* Stats */
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  statItem: { flex: 1, alignItems: 'center', gap: spacing.valueLabelGap },
  statVal: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xl, lineHeight: typography.size.xl * typography.lineHeight.normal },
  statLbl: { color: colors.textTertiary, fontFamily: typography.family.pixel, fontSize: typography.size.sm, textAlign: 'center', lineHeight: typography.size.sm * typography.lineHeight.normal },
  divider: { width: 1, height: 30, backgroundColor: 'rgba(71,85,105,0.3)' },

  /* Chart */
  chartScroll: { marginTop: spacing.xs },
  hint: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.lg, textAlign: 'center', lineHeight: typography.size.lg * typography.lineHeight.normal },
  miniChartLabel: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.sm, letterSpacing: 1, marginBottom: spacing.xs, lineHeight: typography.size.sm * typography.lineHeight.normal },

  /* Legend */
  legRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legText: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.lg, lineHeight: typography.size.lg * typography.lineHeight.normal },

  /* Recommendations */
  recScroll: { gap: 10, paddingVertical: spacing.xs },
  recCard: { width: 120, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderRadius: 4, padding: spacing.md, gap: spacing.sm, alignItems: 'center' },
  recLabel: { fontFamily: typography.family.pixel, fontSize: typography.size.sm, textAlign: 'center', lineHeight: typography.size.sm * typography.lineHeight.normal },
  recTime: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.lg, lineHeight: typography.size.lg * typography.lineHeight.normal },

  /* Insight */
  insightP: { borderColor: 'rgba(251,191,36,0.3)' },
  insightH: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  insightT: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.lg, lineHeight: typography.size.lg * typography.lineHeight.normal },

  /* Trends */
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, marginTop: spacing.xs },
  trendCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  trendVal: { fontFamily: typography.family.pixel, fontSize: typography.size.lg, lineHeight: typography.size.lg * typography.lineHeight.normal },

  /* Forecast */
  forecastRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.sm },
  forecastBlock: { alignItems: 'center', gap: spacing.xs },
  forecastSmall: { color: colors.textTertiary, fontFamily: typography.family.pixel, fontSize: typography.size.xs, lineHeight: typography.size.xs * typography.lineHeight.normal },
  forecastLevel: { fontFamily: typography.family.pixel, fontSize: typography.size.xxl, lineHeight: typography.size.xxl * typography.lineHeight.hero },
  forecastRank: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.md, lineHeight: typography.size.md * typography.lineHeight.normal },
  forecastGain: { color: colors.success, fontFamily: typography.family.pixel, fontSize: typography.size.xs, marginTop: spacing.valueLabelGap, lineHeight: typography.size.xs * typography.lineHeight.normal },
  trendBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});

export default s;
