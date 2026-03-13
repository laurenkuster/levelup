/**
 * firestoreSync.js
 *
 * Cloud-first sync layer.
 *
 * Every write goes to BOTH AsyncStorage (instant local cache) and Firestore
 * (cloud backup). Every read checks the cloud for the freshest copy and
 * caches it locally so subsequent reads are instant even offline.
 *
 * On sign-in, `restoreAllFromCloud()` eagerly pulls every document so the
 * user's data is available on any device, anywhere, at any time.
 *
 * Firestore structure (3 separate collections per user):
 *
 *   users/{uid}/userData/profile       → { age, weight, height, sex }
 *   users/{uid}/userData/calibration   → { bias, predictions, ... }
 *
 *   users/{uid}/quizData/quizLogs      → { logs: [...] }
 *   users/{uid}/quizData/intXp         → { totalXp, level, history: [...] }
 *   users/{uid}/quizData/intScore      → { score, quizCount, lastQuiz }
 *
 *   users/{uid}/sleepData/sleepLogs    → { logs: [...] }
 *   users/{uid}/sleepData/sleepSummary → { totalHours, requiredHours, ... }
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from './firebase';

/* ── helpers ───────────────────────────── */

const getUid = () => auth.currentUser?.uid || null;

/* ── Firestore collection + doc name constants ────── */

/** Which subcollection each doc lives in. */
const COLLECTIONS = {
  USER: 'userData',
  QUIZ: 'quizData',
  SLEEP: 'sleepData',
  FOOD: 'foodData',
};

export const SYNC_DOCS = {
  PROFILE:       'profile',
  CALIBRATION:   'calibration',
  QUIZ_LOGS:     'quizLogs',
  INT_XP:        'intXp',
  INT_SCORE:     'intScore',
  SLEEP_LOGS:    'sleepLogs',
  SLEEP_SUMMARY: 'sleepSummary',
  FOOD_LOGS:     'foodLogs',
};

/** Maps each doc name → { collection, localKey } */
const DOC_META = {
  [SYNC_DOCS.PROFILE]:       { collection: COLLECTIONS.USER,  localKey: 'levelup_profile_v1' },
  [SYNC_DOCS.CALIBRATION]:   { collection: COLLECTIONS.USER,  localKey: 'levelup_calibration_v1' },
  [SYNC_DOCS.QUIZ_LOGS]:     { collection: COLLECTIONS.QUIZ,  localKey: 'levelup_int_log_v1' },
  [SYNC_DOCS.INT_XP]:        { collection: COLLECTIONS.QUIZ,  localKey: 'levelup_int_xp_v1' },
  [SYNC_DOCS.INT_SCORE]:     { collection: COLLECTIONS.QUIZ,  localKey: 'levelup_int_score_v1' },
  [SYNC_DOCS.SLEEP_LOGS]:    { collection: COLLECTIONS.SLEEP, localKey: 'levelup_sleep_log_v1' },
  [SYNC_DOCS.SLEEP_SUMMARY]: { collection: COLLECTIONS.SLEEP, localKey: 'levelup_sleep_mp_v1' },
  [SYNC_DOCS.FOOD_LOGS]:     { collection: COLLECTIONS.FOOD,  localKey: 'levelup_food_log_v1' },
};

/** Build a Firestore doc reference: users/{uid}/{collection}/{docName} */
const getRef = (uid, docName) => {
  const meta = DOC_META[docName];
  if (!meta) throw new Error(`[firestoreSync] Unknown doc: ${docName}`);
  return doc(db, 'users', uid, meta.collection, docName);
};

/* ═══════════════════════════════════════════════════
   WRITE — local + cloud
   ═══════════════════════════════════════════════════ */

/**
 * Save data to BOTH AsyncStorage and Firestore.
 *
 * @param {string} localKey       – AsyncStorage key
 * @param {string} firestoreDoc   – doc name under users/{uid}/{collection}/
 * @param {any}    data           – JSON-serialisable value
 */
export async function saveData(localKey, firestoreDoc, data) {
  // 1. Local save (always — instant)
  await AsyncStorage.setItem(localKey, JSON.stringify(data));

  // 2. Cloud save (best-effort)
  const uid = getUid();
  if (!uid) return;

  try {
    const ref = getRef(uid, firestoreDoc);
    await setDoc(ref, { value: data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn(`[firestoreSync] cloud write failed for ${firestoreDoc}:`, e.message);
  }
}

/* ═══════════════════════════════════════════════════
   READ — cloud-first, local fallback
   ═══════════════════════════════════════════════════ */

/**
 * Load data.
 *   • If online → fetch from Firestore (freshest) and cache it locally.
 *   • If offline / error → fall back to AsyncStorage.
 *
 * @param {string} localKey       – AsyncStorage key
 * @param {string} firestoreDoc   – doc name under users/{uid}/{collection}/
 * @returns {any|null}            – parsed data or null
 */
export async function loadData(localKey, firestoreDoc) {
  const uid = getUid();

  // 1. Try cloud first (freshest, works across devices)
  if (uid) {
    try {
      const ref = getRef(uid, firestoreDoc);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const cloudData = snap.data()?.value ?? null;
        // Cache locally for offline access
        if (cloudData != null) {
          await AsyncStorage.setItem(localKey, JSON.stringify(cloudData));
        }
        return cloudData;
      }
    } catch (e) {
      console.warn(`[firestoreSync] cloud read failed for ${firestoreDoc}, using local:`, e.message);
    }
  }

  // 2. Fallback to local cache
  try {
    const raw = await AsyncStorage.getItem(localKey);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }

  return null;
}

/* ═══════════════════════════════════════════════════
   RESTORE — pull ALL cloud data on sign-in
   ═══════════════════════════════════════════════════ */

/**
 * Eagerly download every known document from Firestore into AsyncStorage.
 * Call this right after a successful sign-in so the user has all their
 * data available immediately, regardless of which device they're on.
 */
export async function restoreAllFromCloud() {
  const uid = getUid();
  if (!uid) return;

  const entries = Object.entries(DOC_META); // [[docName, { collection, localKey }], ...]

  // Fetch all documents in parallel for speed
  const results = await Promise.allSettled(
    entries.map(async ([docName, { localKey }]) => {
      const ref = getRef(uid, docName);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const cloudData = snap.data()?.value ?? null;
        if (cloudData != null) {
          await AsyncStorage.setItem(localKey, JSON.stringify(cloudData));
        }
      }
    }),
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`[firestoreSync] restoreAllFromCloud: ${failed.length}/${entries.length} docs failed`);
  } else {
    console.log('[firestoreSync] restoreAllFromCloud: all data restored ✅');
  }
}
