# Fix "Missing or insufficient permissions" Error

## Step-by-Step Solution

### Option 1: Quick Test (Recommended First)

Use permissive rules to test if the feature works:

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com/
   - Select project: `parking-app-1cb84`

2. **Navigate to Firestore Rules**
   - Click on **Firestore Database** in the left menu
   - Click on the **Rules** tab

3. **Copy Test Rules**
   - Open the file `firestore.rules.test` in this project
   - Copy ALL the content

4. **Paste and Publish**
   - Delete all existing rules in Firebase Console
   - Paste the test rules
   - Click **Publish** button

5. **Test the App**
   - Try saving a parking spot
   - If it works, proceed to Option 2 for production rules

### Option 2: Production Rules (After Testing)

Once Option 1 works, replace with secure production rules:

1. **Open Firebase Console** (same as above)

2. **Navigate to Firestore Rules** (same as above)

3. **Copy Production Rules**
   - Open the file `firestore.rules` in this project
   - Copy ALL the content

4. **Paste and Publish**
   - Replace the test rules with production rules
   - Click **Publish** button

## What These Rules Do

### Test Rules (`firestore.rules.test`)
- Allows ANY authenticated user to read/write saved spots
- **Use only for testing!**
- Not secure for production

### Production Rules (`firestore.rules`)
- Users can only read/write their own saved spots
- Users can only create spots with their own user_id
- Secure and production-ready

## Verification

After updating rules, check the browser console:
- You should see debug logs showing the data being saved
- No more "Missing or insufficient permissions" errors
- Success message when saving spots

## Troubleshooting

If still getting errors after updating rules:

1. **Check Authentication**
   - Make sure user is logged in
   - Check console for "Current auth user" log

2. **Check User ID**
   - Verify "Current user ID" matches "Current auth user" in console logs
   - They should be identical

3. **Wait a Few Seconds**
   - Firestore rules can take 10-60 seconds to propagate
   - Try again after waiting

4. **Clear App Cache**
   - Restart the app
   - Clear React Native cache if needed

## Quick Copy-Paste Rules

### For Testing (Copy this):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saved_spots/{savedSpotId} {
      allow read, write: if request.auth != null;
    }
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /parking_spots/{spotId} {
      allow read, write: if request.auth != null;
    }
    match /bookings/{bookingId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### For Production (Use full rules from `firestore.rules` file)

