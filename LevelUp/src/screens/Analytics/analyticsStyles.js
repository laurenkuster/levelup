import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography, spacing } from '../../theme/typography';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.header },
  headerTitle: { color: colors.accentStrong, fontSize: typography.size.base, fontFamily: typography.family.pixel },
  content: { padding: spacing.base, paddingBottom: 100, gap: spacing.base },

  /* Tabs */
  tabBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, maxHeight: 44 },
  tabBarContent: { paddingHorizontal: 8 },
  tab: { paddingVertical: spacing.md, paddingHorizontal: spacing.base, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accentStrong },
  tabText: { color: '#475569', fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  tabTextActive: { color: colors.accentStrong },

  /* Panels */
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.base, gap: spacing.sm },
  centerPanel: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  sect: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.xs, letterSpacing: 1 },

  loadingText: { color: colors.placeholder, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  noTitle: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.md, marginTop: 8 },
  noText: { color: colors.textMuted, fontFamily: typography.family.mono, fontSize: typography.size.lg, textAlign: 'center', paddingHorizontal: 20 },
  cta: { marginTop: 8, backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 4 },
  ctaT: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },

  /* Score */
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  bigScore: { fontSize: 48, fontFamily: typography.family.pixel },
  energyLabel: { fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  desc: { color: colors.textMuted, fontFamily: typography.family.mono, fontSize: typography.size.base },
  bar: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 3 },
  energyCard: { borderColor: colors.accentBorder },

  /* Badge */
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: typography.family.pixel, fontSize: typography.size.xs },

  /* Stats */
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: 26 },
  statLbl: { color: colors.placeholder, fontFamily: typography.family.pixel, fontSize: typography.size.xs, textAlign: 'center' },
  divider: { width: 1, height: 30, backgroundColor: 'rgba(71,85,105,0.3)' },

  /* Chart */
  chartScroll: { marginTop: 4 },
  hint: { color: '#475569', fontFamily: typography.family.mono, fontSize: 15, textAlign: 'center' },
  miniChartLabel: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.xs, letterSpacing: 1, marginBottom: 4 },

  /* Legend */
  legRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legText: { color: colors.placeholder, fontFamily: typography.family.mono, fontSize: 15 },

  /* Recommendations */
  recScroll: { gap: 10, paddingVertical: 4 },
  recCard: { width: 120, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderRadius: 4, padding: spacing.md, gap: spacing.sm, alignItems: 'center' },
  recLabel: { fontFamily: typography.family.pixel, fontSize: typography.size.xs, textAlign: 'center' },
  recTime: { color: colors.textSoft, fontFamily: typography.family.mono, fontSize: typography.size.lg },

  /* Insight */
  insightP: { borderColor: 'rgba(251,191,36,0.3)' },
  insightH: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightT: { color: colors.textSoft, fontFamily: typography.family.mono, fontSize: typography.size.xl, lineHeight: 26 },

  /* Trends */
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  trendCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  trendVal: { fontFamily: typography.family.pixel, fontSize: typography.size.lg },

  /* Forecast */
  forecastRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingHorizontal: 8 },
  forecastBlock: { alignItems: 'center', gap: 4 },
  forecastSmall: { color: colors.placeholder, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  forecastLevel: { fontFamily: typography.family.pixel, fontSize: typography.size.xxl },
  forecastRank: { color: colors.textMuted, fontFamily: typography.family.mono, fontSize: typography.size.base },
  forecastGain: { color: colors.success, fontFamily: typography.family.pixel, fontSize: typography.size.xs, marginTop: 2 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 },
});

export default s;
