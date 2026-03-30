import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import PixelButton from '../components/PixelButton';
import PixelCard from '../components/PixelCard';
import StatChip from '../components/StatChip';
import { generateQuiz, generateStudyPack } from '../services/openaiService';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { trackStudySessionStarted } from '../services/trackingService';

const IntStudyScreen = ({ navigation, route }) => {
  const { topic = 'No topic', difficulty = 3, link, studyPack: initialPack, questId } = route?.params || {};
  const [studyPack, setStudyPack] = useState(initialPack || null);
  const [loadingStudy, setLoadingStudy] = useState(!initialPack && topic !== 'No topic');
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    if (!studyPack && topic !== 'No topic') {
      trackStudySessionStarted(topic);
      setLoadingStudy(true);
      generateStudyPack({ topic, difficulty, link })
        .then((pack) => {
          if (mounted) {
            setStudyPack(pack);
          }
        })
        .catch((err) => {
          if (mounted) {
            setError(err?.message || 'Failed to load study pack.');
          }
        })
        .finally(() => {
          if (mounted) {
            setLoadingStudy(false);
          }
        });
    }

    return () => {
      mounted = false;
    };
  }, [studyPack, topic, difficulty, link]);

  const canGenerateQuiz = useMemo(() => !!studyPack && !loadingQuiz, [studyPack, loadingQuiz]);

  const handleGenerateQuiz = async () => {
    if (!studyPack || loadingQuiz) {
      return;
    }
    setLoadingQuiz(true);
    setError(null);

    try {
      const quiz = await generateQuiz({
        topic: studyPack.topic,
        difficulty: studyPack.difficulty,
        studyPack,
      });
      navigation.navigate('IntQuiz', { topic: studyPack.topic, quiz, studyPack, questId });
    } catch (err) {
      setError(err?.message || 'Failed to generate quiz.');
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleOpenResource = async (url) => {
    if (!url) {
      return;
    }
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      setError('Unable to open this link.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
          INT STUDY
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PixelCard style={styles.panel}>
          <Text style={styles.label}>Topic</Text>
          <Text style={styles.value}>{topic}</Text>

          <Text style={styles.label}>Difficulty</Text>
          <Text style={styles.value}>{difficulty}</Text>

          <Text style={styles.label}>Link</Text>
          <Text style={styles.value}>{link || 'None'}</Text>
        </PixelCard>

        {loadingStudy ? (
          <PixelCard style={styles.skeletonPanel}>
            <View style={[styles.skeletonLine, styles.skeletonTitle]} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonSpacer]} />
            <View style={[styles.skeletonLine, styles.skeletonTitle]} />
            <View style={styles.skeletonChipRow}>
              <View style={styles.skeletonChip} />
              <View style={styles.skeletonChip} />
              <View style={styles.skeletonChip} />
            </View>
            <View style={[styles.skeletonLine, styles.skeletonTitle]} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonFooter}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>Generating study pack...</Text>
            </View>
          </PixelCard>
        ) : null}

        {studyPack ? (
          <PixelCard style={styles.panel}>
            <Text style={styles.label}>Summary</Text>
            {studyPack.summary.map((item, index) => (
              <Text key={`summary-${index}`} style={styles.listItem}>
                - {item}
              </Text>
            ))}

            <Text style={styles.label}>Key Terms</Text>
            <View style={styles.tagsWrap}>
              {studyPack.key_terms.map((term, index) => (
                <StatChip key={`term-${index}`} label={term} />
              ))}
            </View>

            <Text style={styles.label}>Resources</Text>
            {studyPack.resources.map((resource, index) => (
              <Pressable
                key={`resource-${index}`}
                onPress={() => handleOpenResource(resource.url)}
                style={({ pressed }) => [styles.resourceRow, pressed && styles.resourceRowPressed]}
              >
                <Text style={styles.resourceTitle} numberOfLines={2} ellipsizeMode="tail">
                  {resource.title}
                </Text>
                <Text style={styles.resourceMeta} numberOfLines={1} ellipsizeMode="tail">
                  {resource.type.toUpperCase()} • {resource.minutes} min
                </Text>
                <Text style={styles.resourceUrl} numberOfLines={1} ellipsizeMode="middle">
                  {resource.url}
                </Text>
                <Text style={styles.resourceCta}>Open resource</Text>
              </Pressable>
            ))}

            <Text style={styles.label}>Quiz Focus</Text>
            {studyPack.quiz_focus.map((item, index) => (
              <Text key={`focus-${index}`} style={styles.listItem}>
                - {item}
              </Text>
            ))}
          </PixelCard>
        ) : null}

        {error ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <PixelButton
          onPress={handleGenerateQuiz}
          disabled={!canGenerateQuiz}
          loading={loadingQuiz}
          title="Ready to test"
          style={styles.primaryBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 34,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.accentStrong,
    fontSize: typography.size.md,
    fontFamily: typography.family.pixel,
    flexShrink: 1,
    marginHorizontal: spacing.sm,
    textAlign: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  panel: {
    gap: 6,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  skeletonPanel: {
    padding: spacing.lg,
    borderColor: 'rgba(37,123,244,0.3)',
    backgroundColor: colors.surfaceAlt,
    gap: spacing.sm,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 6,
    backgroundColor: colors.skeleton,
  },
  skeletonTitle: {
    width: '55%',
    height: 16,
  },
  skeletonSpacer: {
    width: '80%',
  },
  skeletonChipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  skeletonChip: {
    width: 60,
    height: 22,
    borderRadius: 12,
    backgroundColor: colors.skeletonSoft,
  },
  skeletonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  label: {
    color: colors.textLabel,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
    marginTop: spacing.sm,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.xl,
    marginBottom: spacing.sm,
  },
  listItem: {
    color: colors.textSoft,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  resourceRow: {
    paddingVertical: spacing.xs,
  },
  resourceRowPressed: {
    opacity: 0.8,
  },
  resourceTitle: {
    color: colors.textPrimary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.xl,
  },
  resourceMeta: {
    color: colors.textLabel,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  resourceUrl: {
    color: colors.textMuted,
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
  },
  resourceCta: {
    color: colors.textLink,
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
  },
  errorPanel: {
    padding: spacing.md,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  errorText: {
    color: colors.error,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  primaryBtn: {
    alignSelf: 'center',
  },
});

export default IntStudyScreen;
