import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { typography, spacing } from './typography';

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.lg,
    fontFamily: typography.family.pixel,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.lg,
    fontFamily: typography.family.mono,
    marginTop: spacing.xs,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 100,
    gap: spacing.base,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.cardPadding,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.lg,
    fontFamily: typography.family.pixel,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
});

/**
 * Reusable text styles that map to the design token hierarchy.
 * Use these for consistent text rendering across all screens.
 */
export const textStyles = StyleSheet.create({
  /** Hero numbers — stat values like energy score "75" */
  hero: {
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xxl,
    lineHeight: typography.size.xxl * typography.lineHeight.hero,
    color: colors.textPrimary,
  },
  /** Section values — "1790", "100%", "8h" */
  value: {
    fontFamily: typography.family.mono,
    fontSize: typography.size.xl,
    lineHeight: typography.size.xl * typography.lineHeight.normal,
    color: colors.textPrimary,
  },
  /** Section headers — "RECOVERY BREAKDOWN", "FOOD ANALYTICS" */
  heading: {
    fontFamily: typography.family.pixel,
    fontSize: typography.size.lg,
    lineHeight: typography.size.lg * typography.lineHeight.normal,
    color: colors.textPrimary,
  },
  /** Body text, status labels, insight text */
  body: {
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
    color: colors.textSecondary,
  },
  /** Sublabels — "KCAL TODAY", "LAST NIGHT", XP progress */
  sublabel: {
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    color: colors.textSecondary,
  },
  /** Tertiary info, timestamps, minor annotations */
  caption: {
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
    color: colors.textTertiary,
  },
});
