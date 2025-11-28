# Firestore Security Rules Setup

## Issue
If you're getting a "missing or insufficient permissions" error when saving parking spots, you need to update your Firestore security rules.

## Quick Fix (For Testing)

**Use the permissive test rules first to verify everything works:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `parking-app-1cb84`
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy and paste the rules from `firestore.rules.test` file (more permissive for testing)
5. Click **Publish** to save the rules
6. Test the "Save for Later" feature
7. Once confirmed working, replace with production rules from `firestore.rules`

## Production Rules Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `parking-app-1cb84`
3. Navigate to **Firestore Database** → **Rules** tab
4. Replace the existing rules with the content from `firestore.rules` file in this project
5. Click **Publish** to save the rules

## Quick Rules (Copy & Paste)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Usernames collection
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.uid;
    }
    
    // Parking spots collection
    match /parking_spots/{spotId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Bookings collection
    match /bookings/{bookingId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.user_id;
    }
    
    // Saved spots collection - IMPORTANT for "Save for Later" feature
    match /saved_spots/{savedSpotId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.user_id;
    }
  }
}
```

## What Changed

The `saveParkingSpotForLater` function now saves only the essential fields:
- `user_id` - The user who saved the spot
- `title` - Parking spot name/title
- `address` - Full address
- `price` - Price (number)
- `capacity_available` - Available spots (number)
- `capacity_total` - Total spots (number)
- `distance` - Distance in km (optional)
- `latitude` / `longitude` - Coordinates (optional)
- `saved_at` - Timestamp

This simplified structure avoids permission issues with nested objects and ensures all data is stored in a flat, accessible format.

