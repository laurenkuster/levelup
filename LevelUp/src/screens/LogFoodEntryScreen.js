import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { analyzeFood } from '../services/geminiService';
import { saveData, loadData, SYNC_DOCS } from '../services/firestoreSync';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { trackFoodLogged } from '../services/trackingService';

const FOOD_LOG_KEY = 'levelup_food_log_v1';

/* ── helpers ── */
const pad = (n) => String(n).padStart(2, '0');

const fmtDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const shortDate = (iso) => {
  const d = new Date(iso);
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${mon} ${d.getDate()}`;
};

/* ─────────────────────────────────────────────── */

const LogFoodEntryScreen = ({ navigation }) => {
  const [logs, setLogs] = useState([]);
  const [imageUri, setImageUri] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Form fields
  const [food, setFood] = useState('');
  const [quantity, setQuantity] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [mealTime, setMealTime] = useState(new Date());

  // Tab: 'camera' | 'manual'
  const [mode, setMode] = useState('camera');

  /* ── load logs on focus ── */
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const data = await loadData(FOOD_LOG_KEY, SYNC_DOCS.FOOD_LOGS);
          if (data) setLogs(data);
        } catch (_) { /* ignore */ }
      })();
    }, []),
  );

  /* ── image picking ── */
  const pickImage = async (useCamera) => {
    const methodName = useCamera ? 'launchCameraAsync' : 'launchImageLibraryAsync';
    const permResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permResult.granted) {
      Alert.alert('Permission required', `Please allow ${useCamera ? 'camera' : 'photo library'} access.`);
      return;
    }

    const result = await ImagePicker[methodName]({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setAnalyzing(true);

    try {
      const mimeType = asset.mimeType || (asset.uri?.endsWith('.png') ? 'image/png' : 'image/jpeg');
      const nutrition = await analyzeFood(asset.base64, mimeType);
      setFood(nutrition.food);
      setQuantity(nutrition.quantity);
      setCalories(String(nutrition.calories));
      setProtein(String(nutrition.protein));
      setCarbs(String(nutrition.carbs));
      setFats(String(nutrition.fats));
      setMealTime(new Date());
    } catch (e) {
      Alert.alert('Analysis failed', e.message || 'Could not analyse the image.');
    } finally {
      setAnalyzing(false);
    }
  };

  /* ── clear form ── */
  const resetForm = () => {
    setFood('');
    setQuantity('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFats('');
    setImageUri(null);
    setMealTime(new Date());
  };

  /* ── save entry ── */
  const handleSave = async () => {
    if (!food.trim()) {
      Alert.alert('Food required', 'Enter the food name or take a photo.');
      return;
    }

    const entry = {
      id: `${Date.now()}`,
      date: fmtDate(mealTime),
      time: fmtTime(mealTime),
      food: food.trim(),
      quantity: quantity.trim() || 'N/A',
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fats: Number(fats) || 0,
      source: mode === 'camera' ? 'AI' : 'Manual',
      createdAt: new Date().toISOString(),
    };

    const updated = [entry, ...logs].slice(0, 200);
    setLogs(updated);
    await saveData(FOOD_LOG_KEY, SYNC_DOCS.FOOD_LOGS, updated);

    trackFoodLogged({ calories: entry.calories, protein: entry.protein });
    Alert.alert('Saved!', `${entry.food} — ${entry.calories} kcal logged.`);
    resetForm();
  };

  /* ── delete entry ── */
  const handleDelete = async (id) => {
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    await saveData(FOOD_LOG_KEY, SYNC_DOCS.FOOD_LOGS, updated);
  };

  /* ── today's totals ── */
  const today = fmtDate(new Date());
  const todayLogs = logs.filter((l) => l.date === today);
  const totals = todayLogs.reduce(
    (acc, l) => ({
      cal: acc.cal + l.calories,
      p: acc.p + l.protein,
      c: acc.c + l.carbs,
      f: acc.f + l.fats,
    }),
    { cal: 0, p: 0, c: 0, f: 0 },
  );

  /* ═══════════ RENDER ═══════════ */
  return (
    <SafeAreaView style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
        </Pressable>
        <Text style={styles.headerTitle}>FOOD LOG</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* today's summary */}
          <View style={styles.panel}>
            <Text style={styles.label}>TODAY'S INTAKE</Text>
            <View style={styles.macroRow}>
              <MacroPill icon="fire" label="KCAL" value={totals.cal} color="#f59e0b" />
              <MacroPill icon="food-steak" label="PROT" value={`${totals.p}g`} color="#ef4444" />
              <MacroPill icon="barley" label="CARB" value={`${totals.c}g`} color="#3b82f6" />
              <MacroPill icon="water" label="FAT" value={`${totals.f}g`} color="#22c55e" />
            </View>
          </View>

          {/* mode toggle */}
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => setMode('camera')}
              style={[styles.modeBtn, mode === 'camera' && styles.modeBtnActive]}
            >
              <MaterialIcons name="photo-camera" size={18} color={mode === 'camera' ? colors.textPrimary : colors.placeholder} />
              <Text style={[styles.modeBtnText, mode === 'camera' && styles.modeBtnTextActive]}>
                SCAN FOOD
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('manual')}
              style={[styles.modeBtn, mode === 'manual' && styles.modeBtnActive]}
            >
              <MaterialIcons name="edit" size={18} color={mode === 'manual' ? colors.textPrimary : colors.placeholder} />
              <Text style={[styles.modeBtnText, mode === 'manual' && styles.modeBtnTextActive]}>
                LOG MANUAL
              </Text>
            </Pressable>
          </View>

          {/* ── Camera / Image mode ── */}
          {mode === 'camera' && (
            <View style={styles.panel}>
              <Text style={styles.label}>SNAP YOUR MEAL</Text>
              <View style={styles.cameraRow}>
                <Pressable
                  onPress={() => pickImage(true)}
                  style={({ pressed }) => [styles.cameraBtn, pressed && styles.cameraBtnPressed]}
                >
                  <MaterialIcons name="camera-alt" size={28} color={colors.textPrimary} />
                  <Text style={styles.cameraBtnText}>CAMERA</Text>
                </Pressable>
                <Pressable
                  onPress={() => pickImage(false)}
                  style={({ pressed }) => [styles.cameraBtn, styles.galleryBtn, pressed && styles.cameraBtnPressed]}
                >
                  <MaterialIcons name="photo-library" size={28} color={colors.textPrimary} />
                  <Text style={styles.cameraBtnText}>GALLERY</Text>
                </Pressable>
              </View>

              {analyzing && (
                <View style={styles.analyzingBox}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text style={styles.analyzingText}>Gemini is analyzing your food...</Text>
                </View>
              )}

              {imageUri && !analyzing && (
                <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
              )}
            </View>
          )}

          {/* ── Nutrition form (shown in both modes, auto-filled in camera mode) ── */}
          <View style={styles.panel}>
            <Text style={styles.label}>NUTRITION INFO</Text>

            <Text style={styles.fieldLabel}>Food</Text>
            <TextInput
              style={styles.input}
              value={food}
              onChangeText={setFood}
              placeholder="e.g. Grilled Chicken Salad"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={styles.fieldLabel}>Quantity / Portion</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="e.g. 1 plate, 250g"
              placeholderTextColor={colors.placeholder}
            />

            <View style={styles.nutritionGrid}>
              <NutritionInput label="Calories" value={calories} onChange={setCalories} unit="kcal" />
              <NutritionInput label="Protein" value={protein} onChange={setProtein} unit="g" />
              <NutritionInput label="Carbs" value={carbs} onChange={setCarbs} unit="g" />
              <NutritionInput label="Fats" value={fats} onChange={setFats} unit="g" />
            </View>
          </View>

          {/* save button */}
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            disabled={analyzing}
          >
            <MaterialIcons name="save" size={18} color={colors.textPrimary} />
            <Text style={styles.saveBtnText}>LOG MEAL</Text>
          </Pressable>

          {/* recent logs */}
          {logs.length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.label}>RECENT MEALS</Text>
              {logs.slice(0, 15).map((entry) => (
                <View key={entry.id} style={styles.logRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logFood}>{entry.food}</Text>
                      <Text style={styles.logSource}>{entry.source}</Text>
                    </View>
                    <Text style={styles.logMeta}>
                      {shortDate(entry.createdAt)} {entry.time} • {entry.quantity}
                    </Text>
                    <Text style={styles.logNutrition}>
                      {entry.calories} kcal  •  P {entry.protein}g  •  C {entry.carbs}g  •  F {entry.fats}g
                    </Text>
                  </View>
                  <Pressable onPress={() => handleDelete(entry.id)} hitSlop={10}>
                    <MaterialIcons name="delete-outline" size={20} color="#f87171" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/* ── small components ── */

const MacroPill = ({ icon, label, value, color }) => (
  <View style={[styles.macroPill, { borderColor: `${color}55` }]}>
    <MaterialCommunityIcons name={icon} size={16} color={color} />
    <Text style={[styles.macroPillValue, { color }]}>{value}</Text>
    <Text style={styles.macroPillLabel}>{label}</Text>
  </View>
);

const NutritionInput = ({ label, value, onChange, unit }) => (
  <View style={styles.nutritionInputWrap}>
    <Text style={styles.nutritionLabel}>{label}</Text>
    <View style={styles.nutritionInputRow}>
      <TextInput
        style={styles.nutritionInput}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, ''))}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.placeholder}
      />
      <Text style={styles.nutritionUnit}>{unit}</Text>
    </View>
  </View>
);

/* ═══════════ STYLES ═══════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerTitle: { color: colors.accentStrong, fontSize: typography.size.md, fontFamily: typography.family.pixel },
  content: { padding: spacing.base, gap: spacing.md, paddingBottom: 60 },

  /* panels */
  panel: {
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: spacing.base, gap: spacing.sm,
  },
  label: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  fieldLabel: { color: colors.textSecondary, fontFamily: typography.family.pixel, fontSize: typography.size.xs, marginTop: spacing.xs },

  /* macro pills */
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  macroPill: {
    flex: 1, alignItems: 'center', gap: spacing.valueLabelGap, paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderRadius: 4,
  },
  macroPillValue: { fontFamily: typography.family.mono, fontSize: typography.size.xl },
  macroPillLabel: { fontFamily: typography.family.pixel, fontSize: typography.size.xs, color: colors.textSecondary },

  /* mode toggle */
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.md, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.accentSoft,
  },
  modeBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeBtnText: { fontFamily: typography.family.pixel, fontSize: typography.size.xs, color: colors.textTertiary },
  modeBtnTextActive: { color: colors.textPrimary },

  /* camera */
  cameraRow: { flexDirection: 'row', gap: spacing.sm },
  cameraBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingVertical: spacing.xl, backgroundColor: colors.accent,
    borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 4,
  },
  galleryBtn: { backgroundColor: '#1e3a5f' },
  cameraBtnPressed: { opacity: 0.8 },
  cameraBtnText: { fontFamily: typography.family.pixel, fontSize: typography.size.xs, color: colors.textPrimary },

  analyzingBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentSoft, borderRadius: 4,
  },
  analyzingText: { color: colors.textLabel, fontFamily: typography.family.mono, fontSize: typography.size.lg },

  preview: { width: '100%', height: 200, borderRadius: 4, borderWidth: 1, borderColor: colors.accentSoft },

  /* form inputs */
  input: {
    height: 42, backgroundColor: colors.surfaceAlt, borderWidth: 1,
    borderColor: colors.accentOutline, color: colors.textPrimary,
    paddingHorizontal: spacing.sm, fontFamily: typography.family.mono, fontSize: typography.size.lg,
  },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nutritionInputWrap: { width: '47%' },
  nutritionLabel: { color: colors.textSecondary, fontFamily: typography.family.pixel, fontSize: typography.size.xs, marginBottom: spacing.xs },
  nutritionInputRow: { flexDirection: 'row', alignItems: 'center' },
  nutritionInput: {
    flex: 1, height: 38, backgroundColor: colors.surfaceAlt, borderWidth: 1,
    borderColor: colors.accentOutline, color: colors.textPrimary,
    paddingHorizontal: spacing.sm, fontFamily: typography.family.mono, fontSize: typography.size.xl,
  },
  nutritionUnit: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.lg, marginLeft: spacing.xs, width: 28 },

  /* save button */
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md, backgroundColor: colors.accent,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },

  /* log rows */
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.15)',
  },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  logFood: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xl, flex: 1 },
  logSource: {
    fontFamily: typography.family.pixel, fontSize: typography.size.xs, color: colors.textSecondary,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.xs, paddingVertical: spacing.valueLabelGap,
  },
  logMeta: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  logNutrition: { color: colors.textLabel, fontFamily: typography.family.mono, fontSize: typography.size.lg },
});

export default LogFoodEntryScreen;
