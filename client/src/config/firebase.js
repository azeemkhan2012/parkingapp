import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDJg4RQ-kIIeWC7-_H_ekEnpNtIWYFyfrM",
  authDomain: "parking-app-1cb84.firebaseapp.com",
  projectId: "parking-app-1cb84",
  storageBucket: "parking-app-1cb84.appspot.com",
  messagingSenderId: "671920183612",
  appId: "1:671920183612:android:9032b722e0f9cbf122e639",
  measurementId: "G-1D00LWJB4F"
};

const app = initializeApp(firebaseConfig);

// Use initializeAuth for React Native persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db = getFirestore(app);

// Auth functions
export const signUp = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

// Firestore functions for parking spots
export const getParkingSpots = async () => {
  try {
    const q = query(
      collection(db, 'parking_spots'),
      where('is_available', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting parking spots:', error);
    return [];
  }
};

export const bookParkingSpot = async (spotId, userId) => {
  try {
    // Update spot as booked
    await updateDoc(doc(db, 'parking_spots', spotId), {
      is_available: false,
      booked_by: userId,
      booked_at: serverTimestamp()
    });

    // Create booking record
    await addDoc(collection(db, 'bookings'), {
      user_id: userId,
      spot_id: spotId,
      booked_at: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const createParkingSpot = async (spotData) => {
  try {
    const docRef = await addDoc(collection(db, 'parking_spots'), {
      ...spotData,
      created_at: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  auth,
  db,
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  getParkingSpots,
  bookParkingSpot,
  createParkingSpot
};