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
    color: colors.accentStrong,
    fontSize: typography.size.lg,
    fontFamily: typography.family.pixel,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    color: colors.textLabel,
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
    padding: spacing.base,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontFamily: typography.family.pixel,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
});
