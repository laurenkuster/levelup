import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const StatStrScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#ffffff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>STR - LVL 1</Text>
          <View style={styles.smallTrack}><View style={styles.smallFill} /></View>
        </View>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="close" size={22} color="#ffffff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <View style={styles.row}><Text style={styles.label}>TOTAL EXPERIENCE</Text><Text style={styles.value}>100 / 1000</Text></View>
          <View style={styles.track}><View style={[styles.fill, { width: '10%' }]} /></View>
          <Text style={styles.rank}>[ ROOKIE LIFTER ]</Text>
        </View>

        <Text style={styles.sectionTitle}>MUSCLE GROUPS</Text>

        <View style={styles.statItem}><Text style={styles.itemName}>CHEST - LVL 3</Text><View style={styles.track}><View style={[styles.fill, { width: '30%' }]} /></View></View>
        <View style={styles.statItem}><Text style={styles.itemName}>BACK - LVL 2</Text><View style={styles.track}><View style={[styles.fill, { width: '20%' }]} /></View></View>
        <View style={styles.statItem}><Text style={styles.itemName}>ARMS - LVL 5</Text><View style={styles.track}><View style={[styles.fill, { width: '50%' }]} /></View></View>
      </ScrollView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101722' },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#ffffff',
    backgroundColor: '#101722',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  title: { color: '#fff', fontFamily: 'PressStart2P', fontSize: 12 },
  smallTrack: { marginTop: 6, width: 120, height: 4, backgroundColor: '#1f2937' },
  smallFill: { height: '100%', width: '50%', backgroundColor: '#3484f4' },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  panel: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#ffffff', padding: 14, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: '#3484f4', fontFamily: 'PressStart2P', fontSize: 10 },
  value: { color: '#fff', fontFamily: 'VT323', fontSize: 20 },
  track: { height: 10, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#475569' },
  fill: { height: '100%', backgroundColor: '#3484f4' },
  rank: { color: '#94a3b8', textAlign: 'center', fontFamily: 'VT323', fontSize: 16 },
  sectionTitle: { color: '#fff', fontFamily: 'PressStart2P', fontSize: 11, marginTop: 4 },
  statItem: { backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: '#334155', padding: 12, gap: 8 },
  itemName: { color: '#fff', fontFamily: 'PressStart2P', fontSize: 10 },
});

export default StatStrScreen;
