/**
 * Script to add a test review for a parking spot
 * Run this from Node.js or use it as a reference for Firebase Console
 * 
 * Usage (if running as script):
 * node addTestReview.js
 */

import {initializeApp} from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDJg4RQ-kIIeWC7-_H_ekEnpNtIWYFyfrM',
  authDomain: 'parking-app-1cb84.firebaseapp.com',
  projectId: 'parking-app-1cb84',
  storageBucket: 'parking-app-1cb84.appspot.com',
  messagingSenderId: '671920183612',
  appId: '1:671920183612:android:9032b722e0f9cbf122e639',
  measurementId: 'G-1D00LWJB4F',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addTestReview() {
  try {
    const spotId = 'khi_145'; // The JSON-style spot_id from your data
    
    console.log('Looking for parking spot with spot_id:', spotId);
    
    // First, find the actual Firestore document ID
    const spotsRef = collection(db, 'parking_spots');
    let q = query(spotsRef, where('spot_id', '==', spotId));
    let querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Try original_data.id
      q = query(spotsRef, where('original_data.id', '==', spotId));
      querySnapshot = await getDocs(q);
    }
    
    if (querySnapshot.empty) {
      // Try direct lookup (in case spot_id is the Firestore document ID)
      const spotRef = doc(db, 'parking_spots', spotId);
      const spotSnap = await getDoc(spotRef);
      if (spotSnap.exists()) {
        console.log('Found spot directly with ID:', spotId);
      } else {
        throw new Error(`Parking spot with spot_id "${spotId}" not found`);
      }
    }
    
    let actualSpotId = spotId;
    if (!querySnapshot.empty) {
      const foundDoc = querySnapshot.docs[0];
      actualSpotId = foundDoc.id;
      console.log('Found spot! Firestore document ID:', actualSpotId);
      console.log('Spot name:', foundDoc.data().name);
    }
    
    // Create test review
    const reviewData = {
      spot_id: actualSpotId, // Use the actual Firestore document ID
      user_id: 'test_user_' + Date.now(), // Test user ID
      user_name: 'Test Reviewer',
      rating: 4,
      review_text: 'Great parking spot! Very convenient location near Expo Centre. The parking area is well-maintained and secure. Would definitely use again.',
      booking_id: null, // No booking linked (unverified review)
      is_verified: false,
      created_at: serverTimestamp(),
    };
    
    console.log('Creating review with data:', {
      ...reviewData,
      created_at: '[serverTimestamp]',
    });
    
    const reviewsRef = collection(db, 'reviews');
    const reviewDocRef = await addDoc(reviewsRef, reviewData);
    
    console.log('✅ Review created successfully!');
    console.log('Review ID:', reviewDocRef.id);
    console.log('Spot ID used:', actualSpotId);
    
    // Update the parking spot's rating and review count
    try {
      const spotRef = doc(db, 'parking_spots', actualSpotId);
      const spotSnap = await getDoc(spotRef);
      
      if (spotSnap.exists()) {
        const spotData = spotSnap.data();
        const currentRating = spotData.rating || 0;
        const currentReviewCount = spotData.review_count || 0;
        
        const newReviewCount = currentReviewCount + 1;
        const newRating = (currentRating * currentReviewCount + reviewData.rating) / newReviewCount;
        
        await updateDoc(spotRef, {
          rating: Math.round(newRating * 10) / 10,
          review_count: newReviewCount,
          updated_at: serverTimestamp(),
        });
        
        console.log('✅ Updated spot rating:', Math.round(newRating * 10) / 10);
        console.log('✅ Updated review count:', newReviewCount);
      }
    } catch (updateError) {
      console.warn('⚠️ Could not update spot rating:', updateError.message);
    }
    
    return {success: true, reviewId: reviewDocRef.id};
  } catch (error) {
    console.error('❌ Error creating review:', error);
    throw error;
  }
}

// If running as a script
if (typeof require !== 'undefined' && require.main === module) {
  addTestReview()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export default addTestReview;

