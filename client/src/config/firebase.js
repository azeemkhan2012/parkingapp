// ../config/firebase.js
import {initializeApp, getApps} from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  verifyBeforeUpdateEmail,
  updateEmail as _updateEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';

// Initialize Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyDJg4RQ-kIIeWC7-_H_ekEnpNtIWYFyfrM',
  authDomain: 'parking-app-1cb84.firebaseapp.com',
  projectId: 'parking-app-1cb84',
  storageBucket: 'parking-app-1cb84.appspot.com',
  messagingSenderId: '671920183612',
  appId: '1:671920183612:android:9032b722e0f9cbf122e639',
  measurementId: 'G-1D00LWJB4F',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Use initializeAuth for React Native persistence (guard for Fast Refresh)
let auth;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
}
export const db = getFirestore(app);

// (place this below your profile helpers)
export const changeAuthEmail = async (newEmail, currentPassword) => {
  const user = getCurrentUser();
  if (!user) {
    const e = new Error('Not signed in');
    e.code = 'auth/not-signed-in';
    throw e;
  }
  if (!currentPassword) {
    const e = new Error('Password required');
    e.code = 'missing-password';
    throw e;
  }

  // Re-authenticate with CURRENT email + password
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);

  // Ask Firebase to send a verification link to the NEW email.
  // (Make sure the URL below is whitelisted under Authentication → Settings → Authorized domains.
  // If you already configured Email Action Settings in the console, you can omit the actionCodeSettings.)
  const actionCodeSettings = {
    url: 'https://parking-app-1cb84.firebaseapp.com',
    handleCodeInApp: false,
  };

  // This DOES NOT change the login email immediately — it sends a link to confirm.
  await verifyBeforeUpdateEmail(user, newEmail.trim(), actionCodeSettings);

  // Do NOT write email to Firestore yet; wait until user clicks the link and the email is actually updated.
  return {success: true, pendingVerification: true};
};

// -------------------- Auth --------------------
export const signUp = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    return {success: true, user: userCredential.user};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    return {success: true, user: userCredential.user};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return {success: true};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

export const getCurrentUser = () => auth.currentUser;

// -------------------- User Profile --------------------
// Firestore: users/{uid} doc with fields from your forms
export const getUserProfile = async uid => {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return {success: false, error: 'Profile not found'};
    return {success: true, userData: snap.data()};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

export const updateUserProfile = async (uid, data) => {
  try {
    const ref = doc(db, 'users', uid);
    await setDoc(
      ref,
      {...data, userId: uid, updated_at: serverTimestamp()},
      {merge: true},
    );
    return {success: true};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

// -------------------- Parking Spots --------------------
export const getParkingSpots = async () => {
  try {
    const q = query(
      collection(db, 'parking_spots'),
      where('is_available', '==', true),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({id: d.id, ...d.data()}));
  } catch (error) {
    console.error('Error getting parking spots:', error);
    return [];
  }
};

// Transactional booking to avoid double-booking
export const bookParkingSpot = async (spotId, userId) => {
  try {
    const spotRef = doc(db, 'parking_spots', spotId);
    const bookingsRef = collection(db, 'bookings');

    await runTransaction(db, async tx => {
      const spotSnap = await tx.get(spotRef);
      if (!spotSnap.exists()) throw new Error('Spot does not exist');
      const spot = spotSnap.data();
      if (!spot.is_available) throw new Error('Spot already booked');

      // Mark spot as booked
      tx.update(spotRef, {
        is_available: false,
        booked_by: userId,
        booked_at: serverTimestamp(),
      });

      // Create booking record
      const bookingDocRef = doc(bookingsRef); // auto-id
      tx.set(bookingDocRef, {
        user_id: userId,
        spot_id: spotId,
        booked_at: serverTimestamp(),
        status: 'active',
      });
    });

    return {success: true};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

const normUsername = u => (u || '').trim().toLowerCase();

// Is username free?
export const isUsernameAvailable = async username => {
  const uname = normUsername(username);
  if (!uname) return false;
  const snap = await getDoc(doc(db, 'usernames', uname));
  return !snap.exists();
};

// Reserve username -> create mapping doc
export const reserveUsername = async (uid, username, email) => {
  const uname = normUsername(username);
  if (!uname) throw new Error('Invalid username');
  // Will fail if doc already exists (rules stop hijacking)
  await setDoc(
    doc(db, 'usernames', uname),
    {
      uid,
      email: (email || '').trim(),
      username_lower: uname,
      created_at: serverTimestamp(),
    },
    {merge: false},
  );
  return {success: true};
};

export const ensureUsernameMapping = async (uid, username, email) => {
  const uname = normUsername(username);
  if (!uname) return {success: false, error: 'invalid-username'};

  const ref = doc(db, 'usernames', uname);
  const snap = await getDoc(ref);
  if (snap.exists()) return {success: true, exists: true};

  // create mapping once
  await setDoc(
    ref,
    {
      uid,
      email: (email || '').trim(),
      username_lower: uname,
      created_at: serverTimestamp(),
    },
    {merge: false},
  );

  return {success: true, created: true};
};

export const signInWithIdentifier = async (identifier, password) => {
  const id = (identifier || '').trim();
  let emailToUse = id;

  // Username path: look up email in /usernames
  if (!id.includes('@')) {
    try {
      const uname = normUsername(id);
      const snap = await getDoc(doc(db, 'usernames', uname));
      if (!snap.exists()) return {success: false, error: 'username-not-found'};
      emailToUse = (snap.data().email || '').trim();
      if (!emailToUse) return {success: false, error: 'username-has-no-email'};
    } catch (e) {
      // bubble up Firestore errors instead of masking them
      return {
        success: false,
        error: e.code || e.message || 'username-lookup-failed',
      };
    }
  }

  // Use your existing signIn (email+password)
  const res = await signIn(emailToUse, password);
  return res;
};

export const createParkingSpot = async spotData => {
  try {
    const docRef = await addDoc(collection(db, 'parking_spots'), {
      ...spotData,
      is_available: spotData?.is_available ?? true,
      created_at: serverTimestamp(),
    });
    return {success: true, id: docRef.id};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

export default {
  auth,
  db,
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  getUserProfile,
  updateUserProfile,
  getParkingSpots,
  bookParkingSpot,
  createParkingSpot,
};
