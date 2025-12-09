# Debug Booking Flow - After Payment

## Current Issues
1. No booking appearing in "My Bookings"
2. Payment status not updating in Firestore (stays "pending")
3. Not navigating to booking page after payment
4. URL.host error showing as alert

## What Should Happen

1. **User clicks "Book Now"**
   - Payment record created in Firestore with `status: 'pending'`
   - Stripe checkout opens

2. **User completes payment**
   - Stripe redirects to: `parkingapp://checkout/success?session_id=...`
   - Deep link handler receives the URL

3. **Deep Link Processing**
   - Extracts `session_id` from URL
   - Calls `handleCheckoutSuccess(sessionId)`

4. **handleCheckoutSuccess Flow**
   - Verifies payment with Stripe API
   - Finds payment record in Firestore
   - Creates booking with `status: 'confirmed'`
   - Updates payment record: `status: 'succeeded'`, `booking_id`, `paid_at`
   - Navigates to "My Bookings" screen

## Debugging Steps

### 1. Check Console Logs

After completing payment, check for these logs:

```
[handleDeepLink] Deep link received: parkingapp://checkout/success?session_id=...
[handleDeepLink] Extracted session ID: cs_test_...
[handleDeepLink] ✅ Processing successful checkout with session: ...
[handleCheckoutSuccess] ===== STARTING =====
[handleCheckoutSuccess] Session ID: cs_test_...
[handleCheckoutSuccess] ✅ Session ID is valid
[handleCheckoutSuccess] Verifying checkout session: ...
[handleCheckoutSuccess] Payment record found: ...
[handleCheckoutSuccess] Attempting to create booking...
[bookParkingSpot] ✅ Booking created successfully!
[handleCheckoutSuccess] ✅ Booking created successfully!
[handleCheckoutSuccess] Updating payment record with booking_id: ...
[handleCheckoutSuccess] ✅ Payment record updated
[handleCheckoutSuccess] Navigating to Bookings screen...
```

### 2. Check Firestore

**Payments Collection:**
- Find payment by `session_id`
- Check if `status` is still `"pending"` or updated to `"succeeded"`
- Check if `booking_id` is set
- Check if `paid_at` is set

**Bookings Collection:**
- Query by `user_id`
- Check if booking exists with `session_id` matching the payment
- Check if `status` is `"confirmed"`

### 3. Manual Test

If deep link isn't working, you can manually test:

1. Get the `session_id` from Firestore payment record
2. In console, call: `handleCheckoutSuccess('cs_test_...')`
3. Check if booking is created

### 4. Check Navigation

After payment, check if navigation happens:
- Look for log: `[handleCheckoutSuccess] Navigating to Bookings screen...`
- Check if `navigationRef.current` is not null

## Common Issues

### Issue 1: Deep Link Not Received
**Symptoms:** No logs starting with `[handleDeepLink]`
**Fix:** Check if deep link URL scheme is configured correctly in app

### Issue 2: URL.host Error Blocking Flow
**Symptoms:** Alert shows "URL.host is not implemented", then nothing happens
**Fix:** The global error handler should suppress this, but if it still shows, the flow should continue anyway

### Issue 3: handleCheckoutSuccess Not Called
**Symptoms:** See `[handleDeepLink]` logs but no `[handleCheckoutSuccess]` logs
**Fix:** Check if `sessionId` is extracted correctly

### Issue 4: Booking Creation Fails
**Symptoms:** See `[handleCheckoutSuccess]` logs but booking not created
**Fix:** Check `[bookParkingSpot]` logs for errors

### Issue 5: Payment Update Fails
**Symptoms:** Booking created but payment status not updated
**Fix:** Check security rules allow user to update their own payments

## Quick Fix Test

If nothing is working, try this in console after payment:

```javascript
// Get session_id from Firestore payment record
const sessionId = 'cs_test_...'; // Replace with actual session ID

// Manually trigger booking creation
handleCheckoutSuccess(sessionId)
  .then(() => console.log('✅ Success'))
  .catch(err => console.error('❌ Error:', err));
```

## Next Steps

1. Check console logs after next payment attempt
2. Share the logs if booking still doesn't appear
3. Check Firestore to see what's actually happening
4. Test manual trigger if deep link isn't working

