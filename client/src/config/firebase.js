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
  deleteDoc,
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

export const bookParkingSpot = async (spotId, userId, bookingData = {}) => {
  try {
    const spotRef = doc(db, 'parking_spots', spotId);
    const bookingsRef = collection(db, 'bookings');

    let bookingId = null;
    await runTransaction(db, async tx => {
      const spotSnap = await tx.get(spotRef);
      if (!spotSnap.exists()) throw new Error('Spot does not exist');
      const spot = spotSnap.data();
      
      // Check availability - handle both boolean and capacity-based availability
      const isAvailable = spot.is_available !== false;
      const availableSpots = spot.availability_available || spot.availability?.available || 0;
      
      if (!isAvailable && availableSpots <= 0) {
        throw new Error('Spot already booked or no spots available');
      }

      // Calculate new availability
      const newAvailableSpots = Math.max(0, availableSpots - 1);
      const totalSpots = spot.availability_total || spot.availability?.total || 1;
      const shouldMarkUnavailable = newAvailableSpots === 0;

      // Update parking spot availability
      const spotUpdate = {
        availability_available: newAvailableSpots,
        updated_at: serverTimestamp(),
      };
      
      if (shouldMarkUnavailable) {
        spotUpdate.is_available = false;
      }
      
      // Store booking info on spot
      if (!spot.bookings) {
        spotUpdate.bookings = [];
      }
      
      tx.update(spotRef, spotUpdate);

      // Create booking document with comprehensive data
      const bookingDocRef = doc(bookingsRef);
      bookingId = bookingDocRef.id;
      
      const bookingDataToStore = {
        user_id: userId,
        spot_id: spotId,
        booked_at: serverTimestamp(),
        status: 'active',
        // Store spot details for reference
        spot_name: spot.name || spot.location?.name || spot.title || 'Parking Spot',
        spot_address: spot.address || spot.original_data?.location?.address || spot.location?.address || 'Address not available',
        spot_latitude: spot.latitude || spot.original_data?.location?.latitude || spot.location?.latitude,
        spot_longitude: spot.longitude || spot.original_data?.location?.longitude || spot.location?.longitude,
        // Payment information
        amount: bookingData.amount || spot.pricing_hourly || spot.price || 0,
        currency: bookingData.currency || 'PKR',
        payment_status: bookingData.payment_status || 'paid',
        payment_method: bookingData.payment_method || 'stripe',
        session_id: bookingData.session_id || null,
        // Booking dates
        booking_start: bookingData.booking_start || serverTimestamp(),
        booking_end: bookingData.booking_end || null,
        // Additional metadata
        ...bookingData,
      };
      
      tx.set(bookingDocRef, bookingDataToStore);
    });

    return {success: true, bookingId};
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

// -------------------- Saved Parking Spots --------------------
export const saveParkingSpotForLater = async (userId, spotData) => {
  try {
    // Extract required fields only
    const title = spotData.name || spotData.location?.name || spotData.title || 'Parking Spot';
    const address = spotData.address || spotData.original_data?.location?.address || spotData.location?.address || 'Address not available';
    
    // Extract price
    let price = 0;
    if (spotData.pricing_hourly) price = spotData.pricing_hourly;
    else if (spotData.pricing_daily) price = spotData.pricing_daily;
    else if (spotData.price) {
      if (typeof spotData.price === 'number') price = spotData.price;
      else if (typeof spotData.price === 'string') {
        const match = spotData.price.match(/\d+(\.\d+)?/);
        price = match ? parseFloat(match[0]) : 0;
      }
    } else if (spotData.pricing?.hourly) price = spotData.pricing.hourly;
    else if (spotData.pricing?.daily) price = spotData.pricing.daily;
    
    // Extract capacity
    let capacity = { available: 0, total: 0 };
    if (spotData.availability_available !== undefined && spotData.availability_total !== undefined) {
      capacity = {
        available: spotData.availability_available,
        total: spotData.availability_total,
      };
    } else if (spotData.availability?.available && spotData.availability?.total) {
      capacity = {
        available: spotData.availability.available,
        total: spotData.availability.total,
      };
    }
    
    // Get distance (if already calculated)
    const distance = spotData.distance || null;
    
    // Get coordinates for duplicate checking
    const lat = spotData.latitude || spotData.original_data?.location?.latitude || spotData.location?.latitude;
    const lon = spotData.longitude || spotData.original_data?.location?.longitude || spotData.location?.longitude;
    const spotId = spotData.id || spotData.spot_id || '';
    
    // Check if already saved - wrapped in try-catch to avoid permission errors
    const savedSpotsRef = collection(db, 'saved_spots');
    let existingDocs = {empty: true, docs: []};
    
    try {
      if (spotId) {
        const q = query(
          savedSpotsRef,
          where('user_id', '==', userId),
          where('spot_id', '==', spotId),
        );
        existingDocs = await getDocs(q);
      } else if (lat && lon) {
        // If no ID, check by coordinates (approximate match)
        const q = query(
          savedSpotsRef,
          where('user_id', '==', userId),
        );
        const allUserSpots = await getDocs(q);
        existingDocs = {
          empty: !allUserSpots.docs.some(doc => {
            const savedData = doc.data();
            const savedLat = savedData.latitude;
            const savedLon = savedData.longitude;
            // Check if coordinates are very close (within 0.0001 degrees, ~11 meters)
            return savedLat && savedLon && 
                   Math.abs(savedLat - lat) < 0.0001 && 
                   Math.abs(savedLon - lon) < 0.0001;
          }),
          docs: allUserSpots.docs.filter(doc => {
            const savedData = doc.data();
            const savedLat = savedData.latitude;
            const savedLon = savedData.longitude;
            return savedLat && savedLon && 
                   Math.abs(savedLat - lat) < 0.0001 && 
                   Math.abs(savedLon - lon) < 0.0001;
          }),
        };
      }
    } catch (checkError) {
      // If duplicate check fails due to permissions, skip it and allow save
      // This is okay - we'll handle duplicates on the client side if needed
      console.warn('Could not check for duplicates:', checkError.message);
      existingDocs = {empty: true, docs: []};
    }
    
    if (!existingDocs.empty) {
      return {success: false, error: 'Spot already saved'};
    }

    // Prepare data object - only include fields with values
    const savedData = {
      user_id: userId,
      title: title,
      address: address,
      price: price || 0,
      capacity_available: capacity.available || 0,
      capacity_total: capacity.total || 0,
      saved_at: serverTimestamp(),
    };
    
    // Add optional fields only if they have values
    if (spotId) savedData.spot_id = spotId;
    if (distance !== null && distance !== undefined) savedData.distance = distance;
    if (lat) savedData.latitude = lat;
    if (lon) savedData.longitude = lon;
    
    // Debug: Log the data being saved
    console.log('Saving parking spot with data:', {
      ...savedData,
      saved_at: 'serverTimestamp()', // Don't log the actual timestamp function
    });
    console.log('Current user ID:', userId);
    const currentUser = getCurrentUser();
    console.log('Current auth user:', currentUser?.uid);
    
    // Verify user_id matches current user
    if (!currentUser || userId !== currentUser.uid) {
      return {success: false, error: 'User ID mismatch or not authenticated'};
    }
    
    // Save only the required fields in a simple structure
    const docRef = await addDoc(savedSpotsRef, savedData);
    return {success: true, id: docRef.id};
  } catch (error) {
    console.error('Error saving parking spot:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    return {success: false, error: error.message};
  }
};

export const getSavedParkingSpots = async userId => {
  try {
    const savedSpotsRef = collection(db, 'saved_spots');
    const q = query(savedSpotsRef, where('user_id', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      // Convert back to format expected by components
      return {
        id: d.id,
        savedSpotId: d.id,
        name: data.title,
        title: data.title,
        address: data.address,
        price: data.price,
        pricing_hourly: data.price,
        distance: data.distance,
        latitude: data.latitude,
        longitude: data.longitude,
        availability_available: data.capacity_available,
        availability_total: data.capacity_total,
        spot_id: data.spot_id,
        saved_at: data.saved_at,
      };
    });
  } catch (error) {
    console.error('Error getting saved spots:', error);
    return [];
  }
};

export const removeSavedParkingSpot = async (savedSpotId) => {
  try {
    const savedSpotRef = doc(db, 'saved_spots', savedSpotId);
    await updateDoc(savedSpotRef, {
      removed_at: serverTimestamp(),
    });
    // Or delete it completely
    // await deleteDoc(savedSpotRef);
    return {success: true};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

export const deleteSavedParkingSpot = async (savedSpotId) => {
  try {
    const savedSpotRef = doc(db, 'saved_spots', savedSpotId);
    await deleteDoc(savedSpotRef);
    return {success: true};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

// -------------------- Bookings --------------------
export const getUserBookings = async (userId, status = null) => {
  try {
    const bookingsRef = collection(db, 'bookings');
    let q;
    
    if (status) {
      q = query(
        bookingsRef,
        where('user_id', '==', userId),
        where('status', '==', status),
      );
    } else {
      q = query(bookingsRef, where('user_id', '==', userId));
    }
    
    const snapshot = await getDocs(q);
    const bookings = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        // Convert Firestore timestamps to readable format
        booked_at: data.booked_at?.toDate?.() || data.booked_at,
        booking_start: data.booking_start?.toDate?.() || data.booking_start,
        booking_end: data.booking_end?.toDate?.() || data.booking_end,
      };
    });
    
    // Sort by most recent first
    bookings.sort((a, b) => {
      const aTime = a.booked_at?.getTime?.() || 0;
      const bTime = b.booked_at?.getTime?.() || 0;
      return bTime - aTime;
    });
    
    return {success: true, bookings};
  } catch (error) {
    console.error('Error getting user bookings:', error);
    return {success: false, error: error.message, bookings: []};
  }
};

export const getBillingHistory = async (userId) => {
  try {
    const bookingsRef = collection(db, 'bookings');
    const q = query(bookingsRef, where('user_id', '==', userId));
    
    const snapshot = await getDocs(q);
    const bills = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        booking_id: d.id,
        spot_name: data.spot_name || 'Parking Spot',
        spot_address: data.spot_address || 'Address not available',
        amount: data.amount || 0,
        currency: data.currency || 'PKR',
        payment_status: data.payment_status || 'unknown',
        payment_method: data.payment_method || 'unknown',
        status: data.status || 'unknown',
        booked_at: data.booked_at?.toDate?.() || data.booked_at,
        booking_start: data.booking_start?.toDate?.() || data.booking_start,
        booking_end: data.booking_end?.toDate?.() || data.booking_end,
        session_id: data.session_id || null,
      };
    });
    
    // Sort by most recent first
    bills.sort((a, b) => {
      const aTime = a.booked_at?.getTime?.() || 0;
      const bTime = b.booked_at?.getTime?.() || 0;
      return bTime - aTime;
    });
    
    return {success: true, bills};
  } catch (error) {
    console.error('Error getting billing history:', error);
    return {success: false, error: error.message, bills: []};
  }
};

export const cancelBooking = async (bookingId, userId) => {
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    
    if (!bookingSnap.exists()) {
      return {success: false, error: 'Booking not found'};
    }
    
    const booking = bookingSnap.data();
    if (booking.user_id !== userId) {
      return {success: false, error: 'Unauthorized'};
    }
    
    if (booking.status === 'cancelled') {
      return {success: false, error: 'Booking already cancelled'};
    }
    
    // Update booking status
    await updateDoc(bookingRef, {
      status: 'cancelled',
      cancelled_at: serverTimestamp(),
    });
    
    // Update parking spot availability
    if (booking.spot_id) {
      const spotRef = doc(db, 'parking_spots', booking.spot_id);
      const spotSnap = await getDoc(spotRef);
      
      if (spotSnap.exists()) {
        const spot = spotSnap.data();
        const currentAvailable = spot.availability_available || 0;
        const totalSpots = spot.availability_total || 1;
        const newAvailable = Math.min(totalSpots, currentAvailable + 1);
        
        await updateDoc(spotRef, {
          availability_available: newAvailable,
          is_available: newAvailable > 0,
          updated_at: serverTimestamp(),
        });
      }
    }
    
    return {success: true};
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
  saveParkingSpotForLater,
  getSavedParkingSpots,
  removeSavedParkingSpot,
  deleteSavedParkingSpot,
  getUserBookings,
  getBillingHistory,
  cancelBooking,
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
