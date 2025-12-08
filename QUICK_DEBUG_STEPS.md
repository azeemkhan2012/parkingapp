# Quick Debug Steps - Payment Creation Issue

## Issue: No payments collection in Firestore

The `payments` collection isn't being created. Here's how to debug:

## Step 1: Reload the App

The debug button was just added. You need to reload the app:

**For React Native:**
- Press `R` twice in Metro bundler terminal, OR
- Shake device → "Reload", OR
- Stop and restart: `npm start` then `npm run android`/`npm run ios`

## Step 2: Check if Debug Button Appears

1. Open the app
2. Click the menu icon (top right)
3. Look for "Debug: Check Payment" option
4. If it's there, click it to see payment status

## Step 3: Test Payment Creation

1. Click "Book Now" on a parking spot
2. **Before checkout opens**, check console for:
   - `[startCheckout] Cloud function response: ...`
   - `[startCheckout] SessionId from response: ...`
   - `[startCheckout] Creating payment record with session ID: ...`

3. **After payment/cancel**, use the debug button:
   - Menu → "Debug: Check Payment"
   - It will show the payment creation status

## Step 4: Check Console Logs

Look for these specific logs when clicking "Book Now":

```
[startCheckout] Cloud function response: { url: "...", sessionId: "..." }
[startCheckout] SessionId from response: cs_test_...
[startCheckout] Creating payment record with session ID: cs_test_...
[startCheckout] ✅ Payment record created successfully!
```

OR if it fails:
```
[startCheckout] ❌ Failed to create payment record: [error message]
```

## Step 5: Manual Check in Firestore

1. Go to Firebase Console → Firestore Database
2. Look for `payments` collection
3. If it doesn't exist, the collection will be created when the first payment record is added
4. Check if any documents exist

## Common Issues

### Issue 1: Debug Button Not Showing
**Solution:** Reload the app (Step 1)

### Issue 2: No sessionId in Response
**Symptom:** Console shows `[startCheckout] SessionId from response: undefined`
**Solution:** 
- Check if cloud function is deployed: `firebase functions:list`
- Check function logs: `firebase functions:log --only createCheckoutSession`

### Issue 3: Payment Creation Fails
**Symptom:** Debug shows `status: 'failed'` with error
**Check:**
- Firestore security rules are deployed
- User is logged in
- Network connection is working

### Issue 4: Session ID Has Extra Parameters
**Symptom:** Session ID looks like: `cs_test_...&platform=android&...`
**Solution:** Already fixed in code - session ID is now cleaned

## Quick Test Without Debug Button

If debug button doesn't appear, you can check manually:

1. **Check AsyncStorage directly:**
   - In React Native DevTools console, run:
   ```javascript
   const AsyncStorage = require('@react-native-async-storage/async-storage').default;
   AsyncStorage.getItem('last_payment_attempt').then(d => console.log(JSON.parse(d || '{}')));
   ```

2. **Check Firestore directly:**
   - Go to Firebase Console
   - Firestore Database → Check if `payments` collection exists
   - If it exists, check if any documents are there

3. **Check console logs:**
   - Look for `[startCheckout]` messages
   - These show what's happening during payment creation

## What to Share for Debugging

If payment creation still fails, share:
1. Console logs when clicking "Book Now" (especially `[startCheckout]` messages)
2. What the debug button shows (if visible)
3. Any error messages in console
4. Whether `payments` collection exists in Firestore (even if empty)

