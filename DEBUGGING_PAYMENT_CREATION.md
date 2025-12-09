# Debugging Payment Record Creation

## Issue: Payment records not appearing in Firestore

When you click "Book Now", a payment record should be created in the `payments` collection before the Stripe checkout opens. If it's not appearing, follow these steps:

---

## Step 1: Check Cloud Function Deployment

The `createCheckoutSession` function needs to return `sessionId`. Make sure it's deployed:

```bash
cd client/functions
firebase deploy --only functions:createCheckoutSession
```

**Verify:** Check if the function returns `sessionId`:
- Go to Firebase Console → Functions
- Check if `createCheckoutSession` is deployed
- The function should return: `{ url: "...", sessionId: "cs_..." }`

---

## Step 2: Check Console Logs

When you click "Book Now", check the React Native console/logs for:

1. **"Creating payment record with session ID: ..."** - Should appear if sessionId is received
2. **"Payment record created successfully: ..."** - Should appear if creation succeeds
3. **"Failed to create payment record: ..."** - Will show the error if it fails

**How to check logs:**
- React Native: `npx react-native log-android` or `npx react-native log-ios`
- Or use your IDE's console/debugger
- Or use `console.log` statements in the app

---

## Step 3: Check Firestore Security Rules

The security rules should allow creating payments. Verify in Firebase Console:

1. Go to **Firestore Database** → **Rules**
2. Check the `payments` collection rules:
   ```javascript
   match /payments/{paymentId} {
     allow create: if isAuthenticated() && isCreatingOwnPayment();
   }
   ```

3. **Test the rules:**
   - Make sure you're logged in
   - The `user_id` in the payment document must match your current user ID

---

## Step 4: Manual Test - Create Payment Record

Test if you can create a payment record manually:

1. **In Firebase Console:**
   - Go to Firestore Database
   - Click on `payments` collection
   - Click "+ Add document"
   - Create a document with:
     ```json
     {
       "user_id": "YOUR_USER_ID",
       "spot_id": "test_spot",
       "session_id": "test_session_123",
       "amount": 5000,
       "currency": "usd",
       "status": "pending",
       "payment_method": "stripe",
       "booking_id": null,
       "payment_intent_id": null,
       "stripe_customer_id": null,
       "metadata": {},
       "created_at": [Server Timestamp],
       "paid_at": null,
       "refunded_at": null
     }
     ```

2. **If this fails:**
   - Security rules are blocking creation
   - Check error message in Firebase Console

---

## Step 5: Check Network Requests

Check if the `createCheckoutSession` function is being called and what it returns:

1. **In React Native Debugger or Network tab:**
   - Look for request to: `https://us-central1-parking-app-1cb84.cloudfunctions.net/createCheckoutSession`
   - Check the response:
     - Should have `url` field
     - Should have `sessionId` field (if function is updated)

2. **If `sessionId` is missing:**
   - The cloud function needs to be redeployed
   - Or use the fallback: extract session ID from URL

---

## Step 6: Test Payment Creation Function Directly

Add a test button to manually test payment creation:

```javascript
// Temporary test function
const testPaymentCreation = async () => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    Alert.alert('Error', 'Not logged in');
    return;
  }

  const result = await createPaymentRecord(
    currentUser.uid,
    'test_spot_id',
    'test_session_' + Date.now(),
    5000,
    'usd',
    { test: true }
  );

  if (result.success) {
    Alert.alert('Success', `Payment created: ${result.paymentId}`);
  } else {
    Alert.alert('Error', result.error);
  }
};
```

Call this function and check:
- If it succeeds → Function works, issue is with sessionId
- If it fails → Check the error message

---

## Common Issues & Solutions

### Issue 1: "sessionId is undefined"
**Cause:** Cloud function not returning sessionId
**Solution:** 
- Deploy the updated `createCheckoutSession` function
- Or the code will extract sessionId from URL as fallback

### Issue 2: "Permission denied"
**Cause:** Firestore security rules blocking creation
**Solution:**
- Verify you're logged in
- Check `user_id` matches your current user ID
- Verify security rules are deployed

### Issue 3: "Network request failed"
**Cause:** Cloud function not accessible
**Solution:**
- Check if function is deployed
- Check network connectivity
- Verify function URL is correct

### Issue 4: Payment record created but not visible
**Cause:** Querying wrong collection or user_id mismatch
**Solution:**
- Check Firestore Console directly
- Verify `user_id` in payment matches your user ID
- Check if you're querying the right collection

---

## Quick Debug Checklist

- [ ] Cloud function `createCheckoutSession` is deployed
- [ ] Cloud function returns `sessionId` in response
- [ ] User is logged in
- [ ] Firestore security rules allow creating payments
- [ ] Console shows "Creating payment record..." message
- [ ] Console shows success or error message
- [ ] Check Firestore Console → `payments` collection
- [ ] Verify `user_id` in payment matches your user ID

---

## Testing Without Cloud Function

If the cloud function isn't working, you can test payment creation directly:

1. **Create a test payment manually in Firestore**
2. **Or modify the code to create payment without sessionId:**

```javascript
// Temporary: Create payment without sessionId
const paymentResult = await createPaymentRecord(
  currentUser.uid,
  spot.id,
  'temp_session_' + Date.now(), // Temporary session ID
  amountCents,
  currency,
  { spot_name: spot.name || 'Parking Spot' }
);
```

---

## Next Steps

1. **Check console logs** when clicking "Book Now"
2. **Verify cloud function is deployed** and returns sessionId
3. **Check Firestore security rules** are deployed
4. **Test payment creation manually** in Firestore Console
5. **Check network requests** to see what's being returned

If still not working, share:
- Console error messages
- Network request/response
- Firestore security rules error (if any)
- Whether you can create payments manually in Firestore Console

