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
          <MaterialIcons name="arrow-back" size={22} color="#257bf4" />
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
              <MaterialIcons name="photo-camera" size={18} color={mode === 'camera' ? '#FFF' : '#64748b'} />
              <Text style={[styles.modeBtnText, mode === 'camera' && styles.modeBtnTextActive]}>
                SCAN FOOD
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('manual')}
              style={[styles.modeBtn, mode === 'manual' && styles.modeBtnActive]}
            >
              <MaterialIcons name="edit" size={18} color={mode === 'manual' ? '#FFF' : '#64748b'} />
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
                  <MaterialIcons name="camera-alt" size={28} color="#FFF" />
                  <Text style={styles.cameraBtnText}>CAMERA</Text>
                </Pressable>
                <Pressable
                  onPress={() => pickImage(false)}
                  style={({ pressed }) => [styles.cameraBtn, styles.galleryBtn, pressed && styles.cameraBtnPressed]}
                >
                  <MaterialIcons name="photo-library" size={28} color="#FFF" />
                  <Text style={styles.cameraBtnText}>GALLERY</Text>
                </Pressable>
              </View>

              {analyzing && (
                <View style={styles.analyzingBox}>
                  <ActivityIndicator color="#257bf4" size="small" />
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
              placeholderTextColor="#64748b"
            />

            <Text style={styles.fieldLabel}>Quantity / Portion</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="e.g. 1 plate, 250g"
              placeholderTextColor="#64748b"
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
            <MaterialIcons name="save" size={18} color="#FFFFFF" />
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
        placeholderTextColor="#475569"
      />
      <Text style={styles.nutritionUnit}>{unit}</Text>
    </View>
  </View>
);

/* ═══════════ STYLES ═══════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1B26' },
  header: {
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(37,123,244,0.35)',
    backgroundColor: '#161826', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerTitle: { color: '#3B82F6', fontSize: 12, fontFamily: 'PressStart2P' },
  content: { padding: 16, gap: 14, paddingBottom: 60 },

  /* panels */
  panel: {
    backgroundColor: '#111827', borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.4)', padding: 16, gap: 8,
  },
  label: { color: '#7aaef8', fontFamily: 'PressStart2P', fontSize: 10 },
  fieldLabel: { color: '#94a3b8', fontFamily: 'PressStart2P', fontSize: 8, marginTop: 4 },

  /* macro pills */
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  macroPill: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8,
    backgroundColor: '#0f172a', borderWidth: 1, borderRadius: 4,
  },
  macroPillValue: { fontFamily: 'VT323', fontSize: 22 },
  macroPillLabel: { fontFamily: 'PressStart2P', fontSize: 6, color: '#94a3b8' },

  /* mode toggle */
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, backgroundColor: '#0f172a',
    borderWidth: 1, borderColor: 'rgba(37,123,244,0.3)',
  },
  modeBtnActive: { backgroundColor: '#257bf4', borderColor: '#257bf4' },
  modeBtnText: { fontFamily: 'PressStart2P', fontSize: 8, color: '#64748b' },
  modeBtnTextActive: { color: '#FFF' },

  /* camera */
  cameraRow: { flexDirection: 'row', gap: 10 },
  cameraBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 24, backgroundColor: '#257bf4',
    borderWidth: 1, borderColor: 'rgba(37,123,244,0.7)', borderRadius: 4,
  },
  galleryBtn: { backgroundColor: '#1e3a5f' },
  cameraBtnPressed: { opacity: 0.8 },
  cameraBtnText: { fontFamily: 'PressStart2P', fontSize: 8, color: '#FFF' },

  analyzingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, backgroundColor: 'rgba(37,123,244,0.1)',
    borderWidth: 1, borderColor: 'rgba(37,123,244,0.3)', borderRadius: 4,
  },
  analyzingText: { color: '#7aaef8', fontFamily: 'VT323', fontSize: 18 },

  preview: { width: '100%', height: 200, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(37,123,244,0.3)' },

  /* form inputs */
  input: {
    height: 42, backgroundColor: '#0f172a', borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.45)', color: '#FFFFFF',
    paddingHorizontal: 10, fontFamily: 'VT323', fontSize: 18,
  },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nutritionInputWrap: { width: '47%' },
  nutritionLabel: { color: '#94a3b8', fontFamily: 'PressStart2P', fontSize: 7, marginBottom: 4 },
  nutritionInputRow: { flexDirection: 'row', alignItems: 'center' },
  nutritionInput: {
    flex: 1, height: 38, backgroundColor: '#0f172a', borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.45)', color: '#FFFFFF',
    paddingHorizontal: 8, fontFamily: 'VT323', fontSize: 20,
  },
  nutritionUnit: { color: '#64748b', fontFamily: 'VT323', fontSize: 16, marginLeft: 4, width: 28 },

  /* save button */
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, backgroundColor: '#257bf4',
    borderWidth: 1, borderColor: 'rgba(37,123,244,0.7)',
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnText: { color: '#FFFFFF', fontFamily: 'PressStart2P', fontSize: 11 },

  /* log rows */
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.15)',
  },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logFood: { color: '#e2e8f0', fontFamily: 'VT323', fontSize: 22, flex: 1 },
  logSource: {
    fontFamily: 'PressStart2P', fontSize: 6, color: '#94a3b8',
    backgroundColor: '#1e293b', paddingHorizontal: 4, paddingVertical: 2,
  },
  logMeta: { color: '#94a3b8', fontFamily: 'VT323', fontSize: 16 },
  logNutrition: { color: '#7aaef8', fontFamily: 'VT323', fontSize: 16 },
});

export default LogFoodEntryScreen;
