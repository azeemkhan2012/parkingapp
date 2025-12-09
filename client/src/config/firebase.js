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
  runTransaction,
  orderBy,
  limit,
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
    return snapshot.docs.map(d => {
      const data = d.data();
      // Ensure the document ID is always used, even if data contains an id field
      return {
        ...data,
        id: d.id, // Always use the Firestore document ID
      };
    });
  } catch (error) {
    console.error('Error getting parking spots:', error);
    return [];
  }
};

export const bookParkingSpot = async (spotId, userId, bookingData = {}) => {
  // Define refs outside try block so they're available in catch/retry
    const spotRef = doc(db, 'parking_spots', spotId);
    const bookingsRef = collection(db, 'bookings');
    let bookingId = null;
  
  try {
    console.log('[bookParkingSpot] Starting booking creation...');
    console.log('[bookParkingSpot] Spot ID:', spotId);
    console.log('[bookParkingSpot] User ID:', userId);
    
    // Don't stringify bookingData - it might contain Date objects or other non-serializable data
    console.log('[bookParkingSpot] Booking data keys:', Object.keys(bookingData));
    console.log('[bookParkingSpot] Booking status:', bookingData.status);
    console.log('[bookParkingSpot] Payment ID:', bookingData.payment_id);
    await runTransaction(db, async tx => {
      const spotSnap = await tx.get(spotRef);
      if (!spotSnap.exists()) {
        console.error('[bookParkingSpot] Spot does not exist:', spotId);
        throw new Error('Spot does not exist');
      }
      const spot = spotSnap.data();
      console.log('[bookParkingSpot] Spot found:', spot.name || spotId);

      // Check availability - handle both boolean and capacity-based availability
      const isAvailable = spot.is_available !== false;
      const availableSpots =
        spot.availability_available || spot.availability?.available || 0;

      console.log('[bookParkingSpot] Spot availability:', {
        isAvailable,
        availableSpots,
        totalSpots: spot.availability_total || spot.availability?.total || 1,
      });

      if (!isAvailable && availableSpots <= 0) {
        console.error('[bookParkingSpot] Spot not available');
        throw new Error('Spot already booked or no spots available');
      }

      // Calculate new availability
      const newAvailableSpots = Math.max(0, availableSpots - 1);
      const totalSpots =
        spot.availability_total || spot.availability?.total || 1;
      const shouldMarkUnavailable = newAvailableSpots === 0;

      console.log('[bookParkingSpot] Updating spot availability:', {
        old: availableSpots,
        new: newAvailableSpots,
        shouldMarkUnavailable,
      });

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

      // Extract date fields from bookingData to avoid passing Date objects
      const {confirmed_at, booking_start, booking_end, ...restBookingData} = bookingData;

      const bookingDataToStore = {
        user_id: userId,
        spot_id: spotId,
        booked_at: serverTimestamp(),
        status: bookingData.status || 'active', // Allow status to be set (e.g., 'confirmed' after payment)
        // Store spot details for reference
        spot_name:
          spot.name || spot.location?.name || spot.title || 'Parking Spot',
        spot_address:
          spot.address ||
          spot.original_data?.location?.address ||
          spot.location?.address ||
          'Address not available',
        spot_latitude:
          spot.latitude ||
          spot.original_data?.location?.latitude ||
          spot.location?.latitude,
        spot_longitude:
          spot.longitude ||
          spot.original_data?.location?.longitude ||
          spot.location?.longitude,
        // Payment information
        payment_id: bookingData.payment_id || null, // Link to payments collection
        amount: bookingData.amount || spot.pricing_hourly || spot.price || 0,
        currency: bookingData.currency || 'USD',
        payment_status: bookingData.payment_status || 'paid',
        payment_method: bookingData.payment_method || 'stripe',
        session_id: bookingData.session_id || null,
        // Booking dates - always use serverTimestamp to avoid Date object serialization issues
        booking_start: serverTimestamp(),
        booking_end: null,
        confirmed_at: bookingData.status === 'confirmed' ? serverTimestamp() : null,
        // Additional metadata (excluding date fields that we handled above)
        ...restBookingData,
      };

      console.log('[bookParkingSpot] Creating booking document:', bookingId);
      // Don't stringify bookingDataToStore - it contains serverTimestamp() which can't be serialized
      console.log('[bookParkingSpot] Booking data keys:', Object.keys(bookingDataToStore));

      tx.set(bookingDocRef, bookingDataToStore);
    });

    console.log('[bookParkingSpot] ✅ Booking created successfully!');
    console.log('[bookParkingSpot] Booking ID:', bookingId);
    return {success: true, bookingId};
  } catch (error) {
    // Check if it's a URL.host error - if so, try a simpler retry
    const errorMessage = error?.message || String(error);
    const errorString = String(error);
    const errorCode = error?.code || '';
    const errorCause = error?.cause?.message || error?.cause || '';
    const errorStack = error?.stack || '';
    
    // Check for URL.host error in multiple ways - check all possible locations
    const allErrorText = `${errorMessage} ${errorString} ${errorCode} ${errorCause} ${errorStack}`;
    const isUrlHostError = allErrorText.includes('URL.host') || 
                          allErrorText.includes('URL.host is not implemented') ||
                          errorMessage.includes('URL.host') || 
                          errorMessage.includes('URL.host is not implemented') ||
                          errorString.includes('URL.host') || 
                          errorString.includes('URL.host is not implemented') ||
                          errorStack.includes('URL.host');
    
    // Try retry for URL.host errors OR any FirebaseError with unknown code (common for serialization issues)
    const shouldRetry = isUrlHostError || (error?.name === 'FirebaseError' && (errorCode === 'unknown' || !errorCode));
    
    // Only log full error details if we're not going to retry (to reduce noise)
    if (!shouldRetry) {
      console.error('[bookParkingSpot] ❌ Error creating booking:', error);
      console.error('[bookParkingSpot] Error message:', error?.message);
      console.error('[bookParkingSpot] Error stack:', error?.stack);
    } else {
      // For retry-able errors, just log a brief message
      console.warn('[bookParkingSpot] ⚠️ Initial booking attempt failed (will retry):', errorMessage.substring(0, 100));
    }
    
    console.log('[bookParkingSpot] 🔍 Checking for URL.host error...', {
      isUrlHostError,
      errorMessage: errorMessage.substring(0, 100),
      errorString: errorString.substring(0, 100),
      errorCode,
      hasUrlHostInMessage: errorMessage.includes('URL.host'),
      hasUrlHostInString: errorString.includes('URL.host'),
      hasUrlHostInStack: errorStack.includes('URL.host'),
      shouldRetry,
    });
    
    if (shouldRetry) {
      console.warn('[bookParkingSpot] 🔄 Error detected that may benefit from retry:', {
        isUrlHostError,
        isFirebaseError: error?.name === 'FirebaseError',
        errorCode,
        willRetry: true,
      });
      console.warn('[bookParkingSpot] 🔄 URL.host error detected, retrying with writeBatch (no serverTimestamp)...');
      console.warn('[bookParkingSpot] 🔄 Starting retry attempt...');
      
      try {
        // Retry using writeBatch and avoid serverTimestamp() which might cause URL.host error
        const retrySpotRef = doc(db, 'parking_spots', spotId);
        const retryBookingsRef = collection(db, 'bookings');
        
        // Extract booking data first (may contain location data from original spot)
        const paymentId = (bookingData.payment_id && typeof bookingData.payment_id === 'string') ? bookingData.payment_id : null;
        const sessionId = (bookingData.session_id && typeof bookingData.session_id === 'string') ? bookingData.session_id : null;
        const status = (bookingData.status && typeof bookingData.status === 'string') ? bookingData.status : 'confirmed';
        const amount = (typeof bookingData.amount === 'number') ? bookingData.amount : 0;
        const currency = (bookingData.currency && typeof bookingData.currency === 'string') ? bookingData.currency : 'USD';
        
        // Try to get location data from bookingData first (passed from App.tsx)
        let spotName = (bookingData.spot_name && typeof bookingData.spot_name === 'string') ? bookingData.spot_name : 'Parking Spot';
        let spotAddress = (bookingData.spot_address && typeof bookingData.spot_address === 'string') ? bookingData.spot_address : null;
        let spotLatitude = (typeof bookingData.spot_latitude === 'number') ? bookingData.spot_latitude : null;
        let spotLongitude = (typeof bookingData.spot_longitude === 'number') ? bookingData.spot_longitude : null;
        let availableSpots = 0;
        
        // Try to fetch spot data to get location and update availability
        console.log('[bookParkingSpot] 🔄 Fetching spot data for retry...');
        try {
          const spotSnap = await getDoc(retrySpotRef);
          if (spotSnap.exists()) {
            const spot = spotSnap.data();
            console.log('[bookParkingSpot] 🔄 Spot data fetched successfully');
            
            availableSpots = spot.availability_available || 0;
            if (availableSpots <= 0 && spot.is_available === false) {
              console.warn('[bookParkingSpot] ⚠️ Spot not available, but continuing with booking creation');
            }
            
            // Use spot data if not already in bookingData
            if (!spotName || spotName === 'Parking Spot') {
              spotName = (spot.name && typeof spot.name === 'string') ? spot.name : spotName;
            }
            if (!spotAddress) {
              spotAddress = (spot.address && typeof spot.address === 'string') ? spot.address :
                           (spot.location?.address && typeof spot.location.address === 'string') ? spot.location.address :
                           (spot.original_data?.location?.address && typeof spot.original_data.location.address === 'string') ? spot.original_data.location.address :
                           null;
            }
            if (spotLatitude === null) {
              spotLatitude = (typeof spot.latitude === 'number') ? spot.latitude :
                            (typeof spot.location?.latitude === 'number') ? spot.location.latitude :
                            (typeof spot.original_data?.location?.latitude === 'number') ? spot.original_data.location.latitude :
                            null;
            }
            if (spotLongitude === null) {
              spotLongitude = (typeof spot.longitude === 'number') ? spot.longitude :
                             (typeof spot.location?.longitude === 'number') ? spot.location.longitude :
                             (typeof spot.original_data?.location?.longitude === 'number') ? spot.original_data.location.longitude :
                             null;
            }
          } else {
            console.warn('[bookParkingSpot] ⚠️ Spot does not exist, but continuing with booking creation using bookingData');
          }
        } catch (spotFetchError) {
          console.warn('[bookParkingSpot] ⚠️ Error fetching spot data:', spotFetchError?.message);
          console.warn('[bookParkingSpot] ⚠️ Continuing with booking creation using bookingData');
        }
        
        // Use current timestamp as number instead of serverTimestamp()
        const now = Date.now();
        
        console.log('[bookParkingSpot] 🔄 Creating writeBatch with location data:', {
          spotName,
          hasAddress: !!spotAddress,
          hasLatitude: spotLatitude !== null,
          hasLongitude: spotLongitude !== null,
        });
        
        // Use writeBatch instead of transaction
        const batch = writeBatch(db);
        
        // Try to update spot availability only if spot exists
        try {
          const spotSnap = await getDoc(retrySpotRef);
          if (spotSnap.exists() && availableSpots > 0) {
            batch.update(retrySpotRef, {
              availability_available: Math.max(0, availableSpots - 1),
              updated_at: now,
            });
            console.log('[bookParkingSpot] 🔄 Spot availability will be updated');
          } else {
            console.log('[bookParkingSpot] 🔄 Skipping spot availability update (spot not found or unavailable)');
          }
        } catch (updateError) {
          console.warn('[bookParkingSpot] ⚠️ Could not update spot availability:', updateError?.message);
        }
        
        // Create booking document
        const bookingDocRef = doc(retryBookingsRef);
        bookingId = bookingDocRef.id;
        console.log('[bookParkingSpot] 🔄 Booking ID generated:', bookingId);
        
        // Complete booking data - use timestamp numbers instead of serverTimestamp()
        const bookingDataToStore = {
          user_id: userId,
          spot_id: spotId,
          booked_at: now,
          status: status,
          spot_name: spotName,
          payment_id: paymentId,
          amount: amount,
          currency: currency,
          payment_status: 'paid',
          payment_method: 'stripe',
          session_id: sessionId,
          booking_start: now,
          confirmed_at: now,
        };
        
        // Add location fields - CRITICAL for navigation
        if (spotAddress) bookingDataToStore.spot_address = spotAddress;
        if (spotLatitude !== null) bookingDataToStore.spot_latitude = spotLatitude;
        if (spotLongitude !== null) bookingDataToStore.spot_longitude = spotLongitude;
        
        console.log('[bookParkingSpot] 🔄 Booking data to store:', {
          ...bookingDataToStore,
          spot_address: spotAddress || 'N/A',
          spot_latitude: spotLatitude !== null ? spotLatitude : 'N/A',
          spot_longitude: spotLongitude !== null ? spotLongitude : 'N/A',
        });
        
        batch.set(bookingDocRef, bookingDataToStore);
        
        console.log('[bookParkingSpot] 🔄 Committing batch...');
        // Commit the batch
        await batch.commit();
        console.log('[bookParkingSpot] 🔄 Batch committed successfully!');
        
        console.log('[bookParkingSpot] ✅ Booking created successfully (retry with writeBatch)!');
        console.log('[bookParkingSpot] Booking ID:', bookingId);
        return {success: true, bookingId};
      } catch (retryError) {
        console.error('[bookParkingSpot] ❌ Retry also failed:', retryError);
        console.error('[bookParkingSpot] Retry error message:', retryError?.message);
        console.error('[bookParkingSpot] Retry error stack:', retryError?.stack);
        console.error('[bookParkingSpot] Retry error type:', typeof retryError);
        console.error('[bookParkingSpot] Retry error string:', String(retryError));
        
        // Return the actual error message if it's not URL.host related
        const retryErrorMessage = retryError?.message || String(retryError);
        if (retryErrorMessage.includes('URL.host')) {
          return {success: false, error: 'Booking creation failed due to serialization error. Please try again.'};
        }
        return {success: false, error: retryErrorMessage || 'Booking creation failed. Please try again.'};
      }
    }
    
    return {success: false, error: errorMessage};
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
    const e = new Error('invalid-username');
    e.code = 'invalid-username';
    throw e;
  }

  const newRef = doc(db, 'usernames', newU);
  const oldRef = oldU ? doc(db, 'usernames', oldU) : null;

  // Fail fast if the new username is already taken
  const newSnap = await getDoc(newRef);
  if (newSnap.exists()) {
    const e = new Error('username-taken');
    e.code = 'username-taken';
    throw e;
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
    {username: newUsername, updated_at: serverTimestamp()},
    {merge: true},
  );

  await batch.commit();
  return {success: true};
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
    const title =
      spotData.name ||
      spotData.location?.name ||
      spotData.title ||
      'Parking Spot';
    const address =
      spotData.address ||
      spotData.original_data?.location?.address ||
      spotData.location?.address ||
      'Address not available';

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
    let capacity = {available: 0, total: 0};
    if (
      spotData.availability_available !== undefined &&
      spotData.availability_total !== undefined
    ) {
      capacity = {
        available: spotData.availability_available,
        total: spotData.availability_total,
      };
    } else if (
      spotData.availability?.available &&
      spotData.availability?.total
    ) {
      capacity = {
        available: spotData.availability.available,
        total: spotData.availability.total,
      };
    }

    // Get distance (if already calculated)
    const distance = spotData.distance || null;

    // Get coordinates for duplicate checking
    const lat =
      spotData.latitude ||
      spotData.original_data?.location?.latitude ||
      spotData.location?.latitude;
    const lon =
      spotData.longitude ||
      spotData.original_data?.location?.longitude ||
      spotData.location?.longitude;
    // Always try to get spot_id - it's critical for notifications
    // The spot_id should be the Firestore document ID
    const spotId = spotData.id || spotData.spot_id || '';

    console.log('[saveParkingSpotForLater] Spot ID:', spotId, 'from spotData:', {
      id: spotData.id,
      spot_id: spotData.spot_id,
    });

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
        const q = query(savedSpotsRef, where('user_id', '==', userId));
        const allUserSpots = await getDocs(q);
        existingDocs = {
          empty: !allUserSpots.docs.some(doc => {
            const savedData = doc.data();
            const savedLat = savedData.latitude;
            const savedLon = savedData.longitude;
            // Check if coordinates are very close (within 0.0001 degrees, ~11 meters)
            return (
              savedLat &&
              savedLon &&
              Math.abs(savedLat - lat) < 0.0001 &&
              Math.abs(savedLon - lon) < 0.0001
            );
          }),
          docs: allUserSpots.docs.filter(doc => {
            const savedData = doc.data();
            const savedLat = savedData.latitude;
            const savedLon = savedData.longitude;
            return (
              savedLat &&
              savedLon &&
              Math.abs(savedLat - lat) < 0.0001 &&
              Math.abs(savedLon - lon) < 0.0001
            );
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
    if (distance !== null && distance !== undefined)
      savedData.distance = distance;
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

export const removeSavedParkingSpot = async savedSpotId => {
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

export const deleteSavedParkingSpot = async savedSpotId => {
  try {
    const savedSpotRef = doc(db, 'saved_spots', savedSpotId);
    await deleteDoc(savedSpotRef);
    return {success: true};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

// -------------------- FCM Token Management --------------------
export const saveFCMToken = async (userId, fcmToken) => {
  try {
    const tokenRef = doc(db, 'user_tokens', userId);
    await setDoc(
      tokenRef,
      {
        user_id: userId,
        fcm_token: fcmToken,
        platform: 'android',
        updated_at: serverTimestamp(),
      },
      {merge: true},
    );
    return {success: true};
  } catch (error) {
    console.error('Error saving FCM token:', error);
    return {success: false, error: error.message};
  }
};

export const getFCMToken = async userId => {
  try {
    const tokenRef = doc(db, 'user_tokens', userId);
    const tokenSnap = await getDoc(tokenRef);
    if (tokenSnap.exists()) {
      return {success: true, token: tokenSnap.data().fcm_token};
    }
    return {success: false, error: 'Token not found'};
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return {success: false, error: error.message};
  }
};

export const deleteFCMToken = async userId => {
  try {
    const tokenRef = doc(db, 'user_tokens', userId);
    await deleteDoc(tokenRef);
    return {success: true};
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    return {success: false, error: error.message};
  }
};

// -------------------- Notifications --------------------
/**
 * Get notifications for a user (last 10)
 */
export const getNotifications = async userId => {
  try {
    console.log('[getNotifications] Fetching notifications for user:', userId);

    // Try to query with orderBy first (requires index)
    let snapshot;
    try {
      const q = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc'),
        limit(10),
      );
      snapshot = await getDocs(q);
    } catch (indexError) {
      // If index doesn't exist, fallback to query without orderBy
      console.warn(
        '[getNotifications] Index may not exist, using fallback query:',
        indexError.code,
      );
      const fallbackQ = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
      );
      snapshot = await getDocs(fallbackQ);
    }

    let notifications = snapshot.docs.map(d => ({id: d.id, ...d.data()}));

    // Sort manually by created_at (descending) - handles both Firestore Timestamp and fallback
    if (notifications.length > 0) {
      notifications.sort((a, b) => {
        const aTime =
          a.created_at?.toMillis?.() ||
          a.created_at?.seconds * 1000 ||
          a.created_at?._seconds * 1000 ||
          (a.created_at ? new Date(a.created_at).getTime() : 0) ||
          0;
        const bTime =
          b.created_at?.toMillis?.() ||
          b.created_at?.seconds * 1000 ||
          b.created_at?._seconds * 1000 ||
          (b.created_at ? new Date(b.created_at).getTime() : 0) ||
          0;
        return bTime - aTime; // Descending order (newest first)
      });
    }

    // Limit to 10 after sorting
    notifications = notifications.slice(0, 10);

    console.log(
      '[getNotifications] Found notifications:',
      notifications.length,
    );
    return notifications;
  } catch (error) {
    console.error('[getNotifications] Error getting notifications:', error);
    console.error('[getNotifications] Error code:', error.code);
    console.error('[getNotifications] Error message:', error.message);

    // If it's still an index error even after fallback, provide helpful message
    if (error.code === 'failed-precondition') {
      // Try once more with just the user_id filter
      try {
        console.log('[getNotifications] Trying simplest query...');
        const simpleQ = query(
          collection(db, 'notifications'),
          where('user_id', '==', userId),
        );
        const simpleSnapshot = await getDocs(simpleQ);
        let notifications = simpleSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));

        // Sort manually
        notifications.sort((a, b) => {
          const aTime =
            a.created_at?.toMillis?.() ||
            a.created_at?.seconds * 1000 ||
            (a.created_at ? new Date(a.created_at).getTime() : 0) ||
            0;
          const bTime =
            b.created_at?.toMillis?.() ||
            b.created_at?.seconds * 1000 ||
            (b.created_at ? new Date(b.created_at).getTime() : 0) ||
            0;
          return bTime - aTime;
        });

        return notifications.slice(0, 10);
      } catch (fallbackError) {
        console.error(
          '[getNotifications] Fallback also failed:',
          fallbackError,
        );
        throw new Error(
          'Failed to load notifications. Please create a Firestore index: notifications collection with user_id (Ascending) and created_at (Descending). Check Firebase Console for the index creation link.',
        );
      }
    }

    throw error;
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async notificationId => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
    });
    return {success: true};
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};
// -------------------- Bookings --------------------
export const getUserBookings = async (userId, status = null) => {
  try {
    const bookingsRef = collection(db, 'bookings');
    let snapshot;

    // Try with orderBy first (requires index)
    try {
      let q;
    if (status) {
      q = query(
        bookingsRef,
        where('user_id', '==', userId),
        where('status', '==', status),
          orderBy('booked_at', 'desc'),
      );
    } else {
        q = query(
          bookingsRef,
          where('user_id', '==', userId),
          orderBy('booked_at', 'desc'),
        );
      }
      snapshot = await getDocs(q);
    } catch (indexError) {
      // Fallback to query without orderBy if index doesn't exist
      console.warn(
        '[getUserBookings] Index may not exist, using fallback query:',
        indexError.code,
      );
      let fallbackQ;
      if (status) {
        fallbackQ = query(
          bookingsRef,
          where('user_id', '==', userId),
          where('status', '==', status),
        );
      } else {
        fallbackQ = query(bookingsRef, where('user_id', '==', userId));
      }
      snapshot = await getDocs(fallbackQ);
    }

    const bookings = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        // Convert Firestore timestamps to readable format
        booked_at: data.booked_at?.toDate?.() || data.booked_at,
        booking_start: data.booking_start?.toDate?.() || data.booking_start,
        booking_end: data.booking_end?.toDate?.() || data.booking_end,
        confirmed_at: data.confirmed_at?.toDate?.() || data.confirmed_at,
      };
    });

    // Sort by most recent first (if orderBy wasn't used)
    if (bookings.length > 0) {
    bookings.sort((a, b) => {
      const aTime = a.booked_at?.getTime?.() || 0;
      const bTime = b.booked_at?.getTime?.() || 0;
      return bTime - aTime;
    });
    }

    return {success: true, bookings};
  } catch (error) {
    console.error('Error getting user bookings:', error);
    return {success: false, error: error.message, bookings: []};
  }
};

/**
 * Get billing history from payments collection
 * Joins payment data with booking data for complete information
 */
export const getBillingHistory = async userId => {
  try {
    // Get all payments for the user
    const paymentsRef = collection(db, 'payments');
    let paymentsSnapshot;

    // Try with orderBy first (requires index)
    try {
      const q = query(
        paymentsRef,
        where('user_id', '==', userId),
        orderBy('created_at', 'desc'),
      );
      paymentsSnapshot = await getDocs(q);
    } catch (indexError) {
      // Fallback to query without orderBy if index doesn't exist
      console.warn(
        '[getBillingHistory] Index may not exist, using fallback query:',
        indexError.code,
      );
      const fallbackQ = query(paymentsRef, where('user_id', '==', userId));
      paymentsSnapshot = await getDocs(fallbackQ);
    }

    // Get all payments
    const payments = paymentsSnapshot.docs.map(d => ({
        id: d.id,
      ...d.data(),
      created_at: d.data().created_at?.toDate?.() || d.data().created_at,
      paid_at: d.data().paid_at?.toDate?.() || d.data().paid_at,
      refunded_at: d.data().refunded_at?.toDate?.() || d.data().refunded_at,
    }));

    // Sort manually if orderBy wasn't used
    if (payments.length > 0) {
      payments.sort((a, b) => {
        const aTime =
          a.created_at?.toMillis?.() ||
          a.created_at?.seconds * 1000 ||
          a.created_at?._seconds * 1000 ||
          (a.created_at ? new Date(a.created_at).getTime() : 0) ||
          0;
        const bTime =
          b.created_at?.toMillis?.() ||
          b.created_at?.seconds * 1000 ||
          b.created_at?._seconds * 1000 ||
          (b.created_at ? new Date(b.created_at).getTime() : 0) ||
          0;
        return bTime - aTime; // Descending order (newest first)
      });
    }

    // Get booking data for payments that have bookings
    const bills = await Promise.all(
      payments.map(async payment => {
        let bookingData = null;

        // If payment has a booking_id, fetch booking details
        if (payment.booking_id) {
          try {
            const bookingRef = doc(db, 'bookings', payment.booking_id);
            const bookingSnap = await getDoc(bookingRef);
            if (bookingSnap.exists()) {
              const booking = bookingSnap.data();
              bookingData = {
                id: bookingSnap.id,
                status: booking.status || 'unknown',
                spot_name: booking.spot_name || 'Parking Spot',
                spot_address: booking.spot_address || 'Address not available',
                booking_start: booking.booking_start?.toDate?.() || booking.booking_start,
                booking_end: booking.booking_end?.toDate?.() || booking.booking_end,
                booked_at: booking.booked_at?.toDate?.() || booking.booked_at,
              };
            }
          } catch (bookingError) {
            console.warn(
              `[getBillingHistory] Error fetching booking ${payment.booking_id}:`,
              bookingError,
            );
          }
        }

        // If no booking data, try to get spot data for display
        let spotName = 'Parking Spot';
        let spotAddress = 'Address not available';
        if (!bookingData && payment.spot_id) {
          try {
            const spotRef = doc(db, 'parking_spots', payment.spot_id);
            const spotSnap = await getDoc(spotRef);
            if (spotSnap.exists()) {
              const spot = spotSnap.data();
              spotName =
                spot.name ||
                spot.location?.name ||
                spot.title ||
                'Parking Spot';
              spotAddress =
                spot.address ||
                spot.original_data?.location?.address ||
                spot.location?.address ||
                'Address not available';
            }
          } catch (spotError) {
            console.warn(
              `[getBillingHistory] Error fetching spot ${payment.spot_id}:`,
              spotError,
            );
          }
        }

        // Build bill object with payment and booking data
        return {
          id: payment.id,
          payment_id: payment.id,
          booking_id: payment.booking_id || null,
          spot_id: payment.spot_id,
          spot_name: bookingData?.spot_name || spotName,
          spot_address: bookingData?.spot_address || spotAddress,
          amount: payment.amount ? payment.amount / 100 : 0, // Convert cents to regular amount
          currency: payment.currency?.toUpperCase() || 'USD',
          payment_status: payment.status || 'unknown',
          payment_method: payment.payment_method || 'stripe',
          status: bookingData?.status || (payment.status === 'succeeded' ? 'confirmed' : 'pending'),
          booked_at: bookingData?.booked_at || payment.created_at,
          booking_start: bookingData?.booking_start || null,
          booking_end: bookingData?.booking_end || null,
          session_id: payment.session_id || null,
          payment_intent_id: payment.payment_intent_id || null,
          paid_at: payment.paid_at || null,
          refunded_at: payment.refunded_at || null,
        };
      }),
    );

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
/**
 * Get unread notification count for a user
 */
export const getUnreadCount = async userId => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('read', '==', false),
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// -------------------- Payments Collection --------------------

/**
 * Create a payment record before checkout
 * @param {string} userId - User ID
 * @param {string} spotId - Parking spot ID
 * @param {string} sessionId - Stripe checkout session ID
 * @param {number} amount - Amount in cents
 * @param {string} currency - Currency code (e.g., 'usd', 'pkr')
 * @param {object} metadata - Additional metadata
 * @returns {Promise<{success: boolean, paymentId?: string, error?: string}>}
 */
export const createPaymentRecord = async (
  userId,
  spotId,
  sessionId,
  amount,
  currency = 'usd',
  metadata = {},
) => {
  try {
    const paymentsRef = collection(db, 'payments');
    const paymentData = {
      user_id: userId,
      spot_id: spotId,
      session_id: sessionId,
      booking_id: null, // Will be set after booking is created
      payment_intent_id: null, // Will be set when payment intent is available
      amount: amount,
      currency: currency.toLowerCase(),
      status: 'pending',
      payment_method: 'stripe',
      stripe_customer_id: null,
      metadata: metadata,
      created_at: serverTimestamp(),
      paid_at: null,
      refunded_at: null,
    };

    const docRef = await addDoc(paymentsRef, paymentData);
    return {success: true, paymentId: docRef.id};
  } catch (error) {
    console.error('Error creating payment record:', error);
    return {success: false, error: error.message};
  }
};

/**
 * Update payment status
 * @param {string} paymentId - Payment document ID
 * @param {object} updateData - Data to update
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updatePaymentStatus = async (paymentId, updateData) => {
  try {
    const paymentRef = doc(db, 'payments', paymentId);
    const updateFields = {
      ...updateData,
      updated_at: serverTimestamp(),
    };

    // Set paid_at timestamp if status is being updated to succeeded
    if (updateData.status === 'succeeded' && !updateData.paid_at) {
      updateFields.paid_at = serverTimestamp();
    }

    // Set refunded_at timestamp if status is being updated to refunded
    if (updateData.status === 'refunded' && !updateData.refunded_at) {
      updateFields.refunded_at = serverTimestamp();
    }

    await updateDoc(paymentRef, updateFields);
    return {success: true};
  } catch (error) {
    console.error('Error updating payment status:', error);
    return {success: false, error: error.message};
  }
};

/**
 * Get payment by session ID
 * @param {string} sessionId - Stripe checkout session ID
 * @param {string|null} [userId] - Optional user ID for more secure query
 * @returns {Promise<{success: boolean, payment?: object, error?: string}>}
 */
export const getPaymentBySessionId = async (sessionId, userId = null) => {
  // userId is optional - if provided, query will be more secure and efficient
  try {
    const paymentsRef = collection(db, 'payments');
    
    // If userId is provided, filter by both session_id and user_id for better security rule compliance
    // Otherwise, just filter by session_id (less secure but works if userId not available)
    let q;
    if (userId) {
      q = query(
        paymentsRef, 
        where('session_id', '==', sessionId),
        where('user_id', '==', userId)
      );
    } else {
      q = query(paymentsRef, where('session_id', '==', sessionId));
    }
    
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {success: false, error: 'Payment not found'};
    }

    const paymentDoc = snapshot.docs[0];
    const paymentData = paymentDoc.data();
    return {
      success: true,
      payment: {
        id: paymentDoc.id,
        ...paymentData,
        created_at: paymentData.created_at?.toDate?.() || paymentData.created_at,
        paid_at: paymentData.paid_at?.toDate?.() || paymentData.paid_at,
        refunded_at:
          paymentData.refunded_at?.toDate?.() || paymentData.refunded_at,
      },
    };
  } catch (error) {
    console.error('Error getting payment by session ID:', error);
    return {success: false, error: error.message};
  }
};

/**
 * Get all payments for a user
 * @param {string} userId - User ID
 * @param {string} status - Optional status filter
 * @returns {Promise<{success: boolean, payments?: array, error?: string}>}
 */
export const getUserPayments = async (userId, status = null) => {
  try {
    const paymentsRef = collection(db, 'payments');
    let snapshot;

    // Try with orderBy first (requires index)
    try {
      let q;
      if (status) {
        q = query(
          paymentsRef,
          where('user_id', '==', userId),
          where('status', '==', status),
          orderBy('created_at', 'desc'),
        );
      } else {
        q = query(
          paymentsRef,
          where('user_id', '==', userId),
          orderBy('created_at', 'desc'),
        );
      }
      snapshot = await getDocs(q);
    } catch (indexError) {
      // Fallback to query without orderBy if index doesn't exist
      console.warn(
        '[getUserPayments] Index may not exist, using fallback query:',
        indexError.code,
      );
      let fallbackQ;
      if (status) {
        fallbackQ = query(
          paymentsRef,
          where('user_id', '==', userId),
          where('status', '==', status),
        );
      } else {
        fallbackQ = query(paymentsRef, where('user_id', '==', userId));
      }
      snapshot = await getDocs(fallbackQ);
    }

    let payments = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        created_at: data.created_at?.toDate?.() || data.created_at,
        paid_at: data.paid_at?.toDate?.() || data.paid_at,
        refunded_at: data.refunded_at?.toDate?.() || data.refunded_at,
      };
    });

    // Sort manually by created_at (descending) if orderBy wasn't used
    if (payments.length > 0) {
      payments.sort((a, b) => {
        const aTime =
          a.created_at?.toMillis?.() ||
          a.created_at?.seconds * 1000 ||
          a.created_at?._seconds * 1000 ||
          (a.created_at ? new Date(a.created_at).getTime() : 0) ||
          0;
        const bTime =
          b.created_at?.toMillis?.() ||
          b.created_at?.seconds * 1000 ||
          b.created_at?._seconds * 1000 ||
          (b.created_at ? new Date(b.created_at).getTime() : 0) ||
          0;
        return bTime - aTime; // Descending order (newest first)
      });
    }

    return {success: true, payments};
  } catch (error) {
    console.error('Error getting user payments:', error);
    return {success: false, error: error.message, payments: []};
  }
};

// -------------------- Report Parking Spot --------------------
/**
 * Report parking spot changes (availability, pricing, space)
 * Updates the parking spot in Firestore and triggers notifications
 * @param {string} spotId - Parking spot ID
 * @param {object} reportData - Report data containing changes
 * @param {number} [reportData.availability_available] - New available spots count
 * @param {number} [reportData.availability_total] - New total spots count
 * @param {number} [reportData.pricing_hourly] - New hourly price
 * @param {number} [reportData.pricing_daily] - New daily price
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const reportParkingSpot = async (spotId, reportData) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return {success: false, error: 'User must be logged in to report'};
    }

    if (!spotId) {
      console.error('[reportParkingSpot] No spot ID provided');
      return {success: false, error: 'Spot ID is required'};
    }

    console.log('[reportParkingSpot] Attempting to report spot with ID:', spotId);
    let spotRef = doc(db, 'parking_spots', spotId);
    let spotSnap = await getDoc(spotRef);

    // If direct lookup fails and the ID looks like a JSON ID (e.g., khi_144),
    // try to find the document by querying for original_data.id or id field
    if (!spotSnap.exists() && spotId && spotId.includes('_')) {
      console.log('[reportParkingSpot] Direct lookup failed, trying to find by original_data.id or id field:', spotId);
      try {
        const spotsRef = collection(db, 'parking_spots');
        // Try to find by original_data.id first
        let q = query(spotsRef, where('original_data.id', '==', spotId));
        let querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          // Try to find by id field
          q = query(spotsRef, where('id', '==', spotId));
          querySnapshot = await getDocs(q);
        }
        
        if (!querySnapshot.empty) {
          // Found it! Use the actual Firestore document ID
          const foundDoc = querySnapshot.docs[0];
          console.log('[reportParkingSpot] Found spot by JSON ID, using Firestore document ID:', foundDoc.id);
          spotRef = doc(db, 'parking_spots', foundDoc.id);
          spotSnap = await getDoc(spotRef);
        }
      } catch (queryError) {
        console.error('[reportParkingSpot] Error querying for spot:', queryError);
      }
    }

    if (!spotSnap.exists()) {
      console.error('[reportParkingSpot] Parking spot not found in Firestore:', spotId);
      console.error('[reportParkingSpot] This might indicate the spot ID is incorrect or the spot was deleted');
      return {success: false, error: 'Parking spot not found'};
    }
    
    // Update spotId to the actual Firestore document ID if we found it via query
    const actualSpotId = spotSnap.id;
    if (actualSpotId !== spotId) {
      console.log('[reportParkingSpot] Using actual Firestore document ID:', actualSpotId, 'instead of:', spotId);
    }

    const spotData = spotSnap.data();
    const updateData = {
      updated_at: serverTimestamp(),
    };

    // Update availability if provided
    if (reportData.availability_available !== undefined) {
      const newAvailable = parseInt(reportData.availability_available);
      if (isNaN(newAvailable) || newAvailable < 0) {
        return {success: false, error: 'Invalid availability count'};
      }
      updateData.availability_available = newAvailable;
      
      // Update is_available flag based on availability
      updateData.is_available = newAvailable > 0;
    }

    // Update total spots if provided
    if (reportData.availability_total !== undefined) {
      const newTotal = parseInt(reportData.availability_total);
      if (isNaN(newTotal) || newTotal < 1) {
        return {success: false, error: 'Invalid total spots count'};
      }
      updateData.availability_total = newTotal;
      
      // Ensure available doesn't exceed total
      const currentAvailable = updateData.availability_available !== undefined
        ? updateData.availability_available
        : (spotData.availability_available || 0);
      if (currentAvailable > newTotal) {
        updateData.availability_available = newTotal;
      }
    }

    // Track if we need to update nested pricing
    let needsNestedPricingUpdate = false;
    let nestedPricing = null;

    // Update hourly pricing if provided
    if (reportData.pricing_hourly !== undefined) {
      const newHourlyPrice = parseFloat(reportData.pricing_hourly);
      if (isNaN(newHourlyPrice) || newHourlyPrice < 0) {
        return {success: false, error: 'Invalid hourly price'};
      }
      updateData.pricing_hourly = newHourlyPrice;
      
      // Prepare nested pricing update
      if (spotData.original_data?.pricing) {
        needsNestedPricingUpdate = true;
        const originalPricing = spotData.original_data.pricing;
        nestedPricing = {
          ...originalPricing,
          hourly: newHourlyPrice,
        };
      }
    }

    // Update daily pricing if provided
    if (reportData.pricing_daily !== undefined) {
      const newDailyPrice = parseFloat(reportData.pricing_daily);
      if (isNaN(newDailyPrice) || newDailyPrice < 0) {
        return {success: false, error: 'Invalid daily price'};
      }
      updateData.pricing_daily = newDailyPrice;
      
      // Update nested pricing (merge with existing if already set)
      if (spotData.original_data?.pricing) {
        needsNestedPricingUpdate = true;
        const originalPricing = spotData.original_data.pricing;
        nestedPricing = nestedPricing || {...originalPricing};
        nestedPricing.daily = newDailyPrice;
      }
    }

    // Apply nested pricing update if needed
    if (needsNestedPricingUpdate && nestedPricing) {
      const originalData = spotData.original_data || {};
      updateData.original_data = {
        ...originalData,
        pricing: nestedPricing,
      };
    }

    // Log what will be updated for debugging
    console.log('[reportParkingSpot] Updating parking spot:', {
      spotId: actualSpotId,
      updateData,
      reportData,
    });

    // Create report record for tracking
    const reportRecord = {
      spot_id: actualSpotId,
      user_id: currentUser.uid,
      report_type: 'user_report',
      report_data: reportData,
      created_at: serverTimestamp(),
    };

    // Update the parking spot - this will trigger the Cloud Function
    await updateDoc(spotRef, updateData);

    console.log('[reportParkingSpot] ✅ Parking spot updated in Firestore:', actualSpotId);
    console.log('[reportParkingSpot] Cloud Function should automatically detect changes and send notifications');

    // Store the report in reports collection for audit trail
    try {
      await addDoc(collection(db, 'parking_reports'), reportRecord);
      console.log('[reportParkingSpot] Report record stored for audit trail');
    } catch (reportError) {
      // Log but don't fail if report storage fails
      console.warn('[reportParkingSpot] Failed to store report record:', reportError);
    }

    return {success: true};
  } catch (error) {
    console.error('Error reporting parking spot:', error);
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
  // FCM Token Management
  saveFCMToken,
  getFCMToken,
  deleteFCMToken,
  getUserBookings,
  getBillingHistory,
  cancelBooking,
  // Payments
  createPaymentRecord,
  updatePaymentStatus,
  getPaymentBySessionId,
  getUserPayments,
  // Reporting
  reportParkingSpot,
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
