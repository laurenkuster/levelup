import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from './firebase';
import { saveData, restoreAllFromCloud, SYNC_DOCS } from './firestoreSync';

const INT_XP_KEY = 'levelup_int_xp_v1';

const initBaseStats = async () => {
  try {
    const existing = await AsyncStorage.getItem(INT_XP_KEY);
    if (!existing) {
      const initial = { totalXp: 0, level: 1, history: [] };
      await saveData(INT_XP_KEY, SYNC_DOCS.INT_XP, initial);
    }
  } catch (_) { /* non-fatal */ }
};

export const signUp = async (email, password, displayName) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = displayName.trim();

  const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  const { user } = userCredential;

  // Send verification email immediately — before Firestore write
  // so it's sent even if the db write fails
  try {
    await sendEmailVerification(user);
    // Verification email sent successfully
  } catch (verifyError) {
    console.error('❌ sendEmailVerification failed:', verifyError.code, verifyError.message);
    // Surface the error so the user knows
    throw verifyError;
  }

  try {
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: normalizedName,
      createdAt: serverTimestamp(),
      onboardingComplete: false,
    });
  } catch (firestoreError) {
    console.warn('Firestore profile write failed (non-fatal):', firestoreError);
  }

  await initBaseStats();

  return userCredential;
};

export const signIn = async (email, password) => {
  const normalizedEmail = email.trim().toLowerCase();
  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
  // Restore all user data from cloud (new device, reinstall, etc.)
  await restoreAllFromCloud();
  return credential;
};

export const signInWithGoogleIdToken = async (idToken) => {
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  const { user } = userCredential;

  const userRef = doc(db, 'users', user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    const fallbackName = user.email ? user.email.split('@')[0] : 'Player';
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || fallbackName,
      createdAt: serverTimestamp(),
      onboardingComplete: false,
      provider: 'google',
    });
    await initBaseStats();
  }

  // Restore all user data from cloud
  await restoreAllFromCloud();

  return userCredential;
};

export const signOutUser = async () => {
  await signOut(auth);
};

export const resendVerificationEmail = async () => {
  if (!auth.currentUser) {
    throw new Error('No authenticated user found.');
  }
  await sendEmailVerification(auth.currentUser);
};

export const reloadUser = async () => {
  if (!auth.currentUser) {
    throw new Error('No authenticated user found.');
  }
  await auth.currentUser.reload();
  return auth.currentUser;
};

export const mapAuthError = (error) => {
  const code = error?.code || '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already in use.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-not-found':
      return 'No account found for this email.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    default:
      return error?.message || 'Authentication failed. Please try again.';
  }
};
