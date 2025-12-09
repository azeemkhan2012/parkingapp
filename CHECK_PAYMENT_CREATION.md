# How to Check if Payment Record Was Created

Since DevTools disconnect when Stripe opens, here's how to verify payment creation:

## Method 1: Check AsyncStorage Log (After Reconnecting)

After you reconnect DevTools, run this in the console:

```javascript
// In React Native DevTools console
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
AsyncStorage.getItem('last_payment_attempt').then(data => {
  if (data) {
    const attempt = JSON.parse(data);
    console.log('Last Payment Attempt:', attempt);
    console.log('Status:', attempt.status);
    if (attempt.status === 'success') {
      console.log('✅ Payment record was created!');
      console.log('Payment ID:', attempt.paymentId);
      console.log('Session ID:', attempt.sessionId);
    } else if (attempt.status === 'failed') {
      console.log('❌ Payment record creation failed:', attempt.error);
    }
  } else {
    console.log('No payment attempt logged');
  }
});
```

## Method 2: Check Firestore Directly

1. Go to Firebase Console → Firestore Database
2. Navigate to `payments` collection
3. Look for a document with:
   - `session_id`: The session ID from the deep link (e.g., `cs_test_...`)
   - `user_id`: Your user ID
   - `status`: `'pending'` (if created before payment) or `'succeeded'` (if updated by webhook)

## Method 3: Check After Payment Completes

After payment completes and you're back in the app:

1. Check console for: `[handleCheckoutSuccess] Payment record creation status: ...`
2. This will show if the payment record was created before checkout

## Method 4: Add Debug Button (Temporary)

Add a temporary debug button to check payment status:

```javascript
// In homePage.jsx, add this function:
const checkLastPaymentAttempt = async () => {
  try {
    const data = await AsyncStorage.getItem('last_payment_attempt');
    if (data) {
      const attempt = JSON.parse(data);
      Alert.alert(
        'Last Payment Attempt',
        `Status: ${attempt.status}\nSession ID: ${attempt.sessionId}\nPayment ID: ${attempt.paymentId || 'N/A'}\nError: ${attempt.error || 'None'}`,
      );
    } else {
      Alert.alert('No Payment Attempt', 'No payment attempt logged');
    }
  } catch (e) {
    Alert.alert('Error', e.message);
  }
};
```

## What to Look For

### Success Indicators:
- ✅ `status: 'success'` in AsyncStorage log
- ✅ Payment document exists in Firestore `payments` collection
- ✅ Console shows: `[handleCheckoutSuccess] ✅ Payment record was created before checkout`

### Failure Indicators:
- ❌ `status: 'failed'` in AsyncStorage log
- ❌ Error message in AsyncStorage log
- ❌ No payment document in Firestore
- ❌ Console shows: `[handleCheckoutSuccess] ⚠️ Payment record creation failed`

## Quick Test Steps

1. Click "Book Now" on a parking spot
2. Complete or cancel the payment
3. Reconnect DevTools
4. Run the AsyncStorage check (Method 1)
5. Check Firestore `payments` collection (Method 2)
6. Check console logs for `[handleCheckoutSuccess]` messages

## Expected Flow

1. **Before Checkout Opens:**
   - Payment record created with `status: 'pending'`
   - Logged to AsyncStorage with `status: 'success'`

2. **After Payment Completes:**
   - Webhook (when configured) updates payment to `status: 'succeeded'`
   - Creates booking automatically
   - OR client-side fallback creates booking

3. **After Reconnecting DevTools:**
   - Check AsyncStorage log
   - Check Firestore `payments` collection
   - Verify payment record exists

