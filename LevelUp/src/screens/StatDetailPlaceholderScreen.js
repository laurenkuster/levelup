import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const StatDetailPlaceholderScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>STAT DETAIL</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="close" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}><Text style={styles.label}>TOTAL EXPERIENCE</Text><View style={styles.track}><View style={[styles.fill, { width: '20%' }]} /></View></View>
        <View style={styles.item}><Text style={styles.itemName}>SLOT A</Text><View style={styles.track}><View style={[styles.fill, { width: '35%' }]} /></View></View>
        <View style={styles.item}><Text style={styles.itemName}>SLOT B</Text><View style={styles.track}><View style={[styles.fill, { width: '15%' }]} /></View></View>
        <View style={styles.item}><Text style={styles.itemName}>SLOT C</Text><View style={styles.track}><View style={[styles.fill, { width: '60%' }]} /></View></View>
      </ScrollView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: colors.textPrimary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { width: 34, alignItems: 'center' },
  title: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: 12 },
  content: { padding: 16, paddingBottom: 24, gap: 10 },
  panel: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.textPrimary, padding: 12, gap: 8 },
  label: { color: colors.accent, fontFamily: typography.family.pixel, fontSize: 10 },
  item: { backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.disabled, padding: 12, gap: 8 },
  itemName: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: 10 },
  track: { height: 10, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: '#475569' },
  fill: { height: '100%', backgroundColor: colors.accent },
});

export default StatDetailPlaceholderScreen;
