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
  sendPasswordResetEmail,
  updatePassword,
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
  writeBatch,
  runTransaction
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

// -------------------- Helpers --------------------
export const getCurrentUser = () => auth.currentUser;
const normUsername = u => (u || '').trim().toLowerCase();

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

// Change password for signed-in user (no email link)
export const changePasswordWithCurrentPassword = async (
  currentPassword,
  newPassword,
) => {
  const user = getCurrentUser();
  if (!user) return {success: false, error: 'auth/not-signed-in'};
  try {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
    return {success: true};
  } catch (e) {
    return {success: false, error: e.code || e.message};
  }
};

// Send reset link to email
export const requestPasswordReset = async email => {
  const emailTrim = (email || '').trim();
  if (!emailTrim) return {success: false, error: 'missing-email'};
  try {
    await sendPasswordResetEmail(auth, emailTrim);
    return {success: true};
  } catch (e) {
    return {success: false, error: e.code || e.message};
  }
};

// Verify-before-update email flow
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
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);

  const actionCodeSettings = {
    url: 'https://parking-app-1cb84.firebaseapp.com',
    handleCodeInApp: false,
  };
  await verifyBeforeUpdateEmail(user, newEmail.trim(), actionCodeSettings);
  return {success: true, pendingVerification: true};
};

// After the user clicks the verification link, call this to sync Firestore + username mapping email
export const syncVerifiedEmailToFirestore = async () => {
  const user = getCurrentUser();
  if (!user) throw new Error('Not signed in');
  await user.reload();
  const ref = doc(db, 'users', user.uid);
  await setDoc(
    ref,
    {email: user.email, updated_at: serverTimestamp()},
    {merge: true},
  );

  // also update username mapping email if we have a username
  const snap = await getDoc(ref);
  const username = snap.exists() ? snap.data().username : null;
  if (username) {
    await setDoc(
      doc(db, 'usernames', normUsername(username)),
      {email: user.email, updated_at: serverTimestamp()},
      {merge: true},
    );
  }
  return {success: true, email: user.email};
};

// -------------------- User Profile --------------------
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

export const bookParkingSpot = async (spotId, userId) => {
  try {
    const spotRef = doc(db, 'parking_spots', spotId);
    const bookingsRef = collection(db, 'bookings');

    await runTransaction(db, async tx => {
      const spotSnap = await tx.get(spotRef);
      if (!spotSnap.exists()) throw new Error('Spot does not exist');
      const spot = spotSnap.data();
      if (!spot.is_available) throw new Error('Spot already booked');

      tx.update(spotRef, {
        is_available: false,
        booked_by: userId,
        booked_at: serverTimestamp(),
      });

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

// -------------------- Username mapping (for username login) --------------------
export const isUsernameAvailable = async username => {
  const uname = normUsername(username);
  if (!uname) return false;
  const snap = await getDoc(doc(db, 'usernames', uname));
  return !snap.exists();
};

export const reserveUsername = async (uid, username, email) => {
  const uname = normUsername(username);
  if (!uname) throw new Error('Invalid username');
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

// Transactional username change: creates new mapping, deletes old (if owned), updates users/{uid}.username
export const changeUsername = async (uid, oldUsername, newUsername, email) => {
  const newU = normUsername(newUsername);
  const oldU = normUsername(oldUsername);

  // Basic validation (avoid weird inputs that rules might reject)
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(newU)) {
    const e = new Error('invalid-username'); e.code = 'invalid-username'; throw e;
  }

  const newRef = doc(db, 'usernames', newU);
  const oldRef = oldU ? doc(db, 'usernames', oldU) : null;

  // Fail fast if the new username is already taken
  const newSnap = await getDoc(newRef);
  if (newSnap.exists()) {
    const e = new Error('username-taken'); e.code = 'username-taken'; throw e;
  }

  // Build a batch: create new mapping, delete old (if owned), update users/{uid}
  const batch = writeBatch(db);

  batch.set(newRef, {
    uid,
    email: (email || '').trim(),
    username_lower: newU,
    created_at: serverTimestamp(),
  });

  if (oldRef && oldU !== newU) {
    const oldSnap = await getDoc(oldRef);
    if (oldSnap.exists() && oldSnap.data().uid === uid) {
      batch.delete(oldRef);
    }
  }

  batch.set(
    doc(db, 'users', uid),
    { username: newUsername, updated_at: serverTimestamp() },
    { merge: true }
  );

  await batch.commit();
  return { success: true };
};

// Login with username OR email
export const signInWithIdentifier = async (identifier, password) => {
  const id = (identifier || '').trim();
  let emailToUse = id;

  if (!id.includes('@')) {
    try {
      const uname = normUsername(id);
      const snap = await getDoc(doc(db, 'usernames', uname));
      if (!snap.exists()) return {success: false, error: 'username-not-found'};
      emailToUse = (snap.data().email || '').trim();
      if (!emailToUse) return {success: false, error: 'username-has-no-email'};
    } catch (e) {
      return {
        success: false,
        error: e.code || e.message || 'username-lookup-failed',
      };
    }
  }

  return await signIn(emailToUse, password);
};

// -------------------- Create spot --------------------
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
  // extras
  isUsernameAvailable,
  reserveUsername,
  ensureUsernameMapping,
  changeUsername,
  signInWithIdentifier,
  changeAuthEmail,
  syncVerifiedEmailToFirestore,
  requestPasswordReset,
  changePasswordWithCurrentPassword,
};
