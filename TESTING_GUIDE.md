# Testing Guide - Without Webhook Setup

This guide helps you test the implementation without requiring the Stripe webhook to be configured. The webhook setup can be done later.

## What Can Be Tested Without Webhook

✅ **Can Test Now:**
1. Payment record creation (before checkout)
2. Billing history display (from payments collection)
3. Bookings screen display
4. Navigation from bookings to map
5. Payment collection structure
6. Security rules

❌ **Requires Webhook:**
1. Automatic booking creation after payment
2. Payment status updates via webhook
3. End-to-end payment flow (payment → booking creation)

---

## Testing Steps

### 1. Test Payment Record Creation

**What to test:** Verify that payment records are created before checkout.

**Steps:**
1. Open the app and log in
2. Navigate to a parking spot
3. Click "Book Now" button
4. **Before the Stripe checkout opens**, check Firestore:
   - Go to Firebase Console → Firestore Database
   - Navigate to `payments` collection
   - You should see a new payment document with:
     - `status: 'pending'`
     - `session_id`: (Stripe session ID)
     - `user_id`: (Your user ID)
     - `spot_id`: (Parking spot ID)
     - `amount`: (Amount in cents)
     - `created_at`: (Timestamp)

**Expected Result:** Payment record should be created with `status: 'pending'` before checkout opens.

**If it fails:** Check console logs for errors in `startCheckout()` function.

---

### 2. Test Billing History (Payments Collection)

**What to test:** Verify billing history reads from payments collection.

**Steps:**
1. Manually create a test payment record in Firestore:
   ```javascript
   // In Firebase Console → Firestore → payments collection
   // Click "Add document" and create:
   {
     user_id: "YOUR_USER_ID",
     spot_id: "TEST_SPOT_ID",
     session_id: "test_session_123",
     amount: 5000, // $50.00 in cents
     currency: "usd",
     status: "succeeded",
     payment_method: "stripe",
     payment_intent_id: "test_pi_123",
     created_at: [Server Timestamp],
     paid_at: [Server Timestamp],
     booking_id: null,
     metadata: {
       spot_name: "Test Parking Spot",
       spot_address: "123 Test Street"
     }
   }
   ```

2. In the app, navigate to "Billing History" screen
3. Check if the payment appears in the list

**Expected Result:** 
- Payment should appear in billing history
- Should show amount, currency, status, payment method
- Should show "Paid At" date if `paid_at` is set

**If it fails:** 
- Check `getBillingHistory()` function
- Verify Firestore security rules allow reading payments
- Check console for errors

---

### 3. Test Bookings Screen Display

**What to test:** Verify bookings are displayed correctly.

**Steps:**
1. Create a test booking in Firestore:
   ```javascript
   // In Firebase Console → Firestore → bookings collection
   {
     user_id: "YOUR_USER_ID",
     spot_id: "TEST_SPOT_ID",
     payment_id: "PAYMENT_DOC_ID", // Optional: link to payment
     status: "confirmed",
     spot_name: "Test Parking Spot",
     spot_address: "123 Test Street",
     spot_latitude: 24.8021,
     spot_longitude: 67.03,
     amount: 50,
     currency: "USD",
     payment_status: "paid",
     payment_method: "stripe",
     session_id: "test_session_123",
     booked_at: [Server Timestamp],
     confirmed_at: [Server Timestamp],
     booking_start: [Server Timestamp],
     booking_end: null
   }
   ```

2. In the app, navigate to "My Bookings" screen
3. Verify the booking appears with:
   - Spot name
   - Address
   - Status badge
   - Amount
   - Booking dates
   - "View on Map" button (if coordinates exist)

**Expected Result:** 
- Booking should appear in the list
- All details should be displayed correctly
- Status badge should show correct color

**If it fails:**
- Check `getUserBookings()` function
- Verify Firestore security rules
- Check console for errors

---

### 4. Test Navigation from Bookings to Map

**What to test:** Verify "View on Map" button navigates to map and centers on booking location.

**Steps:**
1. Ensure you have a booking with coordinates (`spot_latitude` and `spot_longitude`)
2. In "My Bookings" screen, find a booking with coordinates
3. Click "View on Map" button
4. Verify:
   - App navigates to home/map screen
   - Map centers on the booking location
   - Zoom level is appropriate (15)
   - Search bar shows spot name or address

**Expected Result:**
- Map should navigate to booking location
- Camera should animate to the location
- Destination coordinates should be set

**If it fails:**
- Check if booking has `spot_latitude` and `spot_longitude`
- Verify `homePage` handles `bookingLocation` parameter
- Check console for navigation errors

---

### 5. Test Payment Helper Functions

**What to test:** Verify payment helper functions work correctly.

**Manual Test in Firebase Console:**
1. Test `getUserPayments()`:
   - Create a few test payment records with different statuses
   - Verify they can be queried by user_id
   - Check sorting (newest first)

2. Test `getPaymentBySessionId()`:
   - Create a payment with a known session_id
   - Verify it can be retrieved by session_id

**Expected Result:**
- Functions should return correct payment data
- Sorting should work correctly
- Queries should respect security rules

---

### 6. Test Security Rules

**What to test:** Verify Firestore security rules work correctly.

**Steps:**
1. Try to read your own payments (should succeed)
2. Try to read another user's payments (should fail)
3. Try to create a payment with your user_id (should succeed)
4. Try to create a payment with another user's user_id (should fail)
5. Try to update a payment (should fail - only webhook can update)

**Expected Result:**
- Users can only read their own payments
- Users can only create payments with their own user_id
- Users cannot update payments (webhook only)

---

## Manual Workaround for Testing Payment → Booking Flow

Since webhook isn't set up, you can manually simulate the webhook behavior:

### Option 1: Manual Booking Creation After Payment

1. Complete a payment in Stripe (or simulate it)
2. Get the `session_id` from the payment
3. Manually create a booking in Firestore:
   ```javascript
   {
     user_id: "YOUR_USER_ID",
     spot_id: "SPOT_ID",
     payment_id: "PAYMENT_DOC_ID",
     status: "confirmed",
     // ... other booking fields
   }
   ```
4. Update the payment record:
   ```javascript
   {
     status: "succeeded",
     booking_id: "BOOKING_DOC_ID",
     paid_at: [Server Timestamp]
   }
   ```

### Option 2: Use Client-Side Fallback

The app has a fallback mechanism in `handleCheckoutSuccess()`:
1. After payment, the app checks if booking exists
2. If not, it creates one client-side
3. This should work even without webhook

**To test:**
1. Complete a payment
2. Check if booking is created (may take a moment)
3. If not created automatically, it will be created by the fallback

---

## What to Configure Later (When Ready)

### Stripe Webhook Setup

1. **Get Webhook Signing Secret:**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Create endpoint: `https://us-central1-parking-app-1cb84.cloudfunctions.net/stripeWebhook`
   - Copy the "Signing secret" (starts with `whsec_`)

2. **Set Firebase Secret:**
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Paste the signing secret when prompted
   ```

3. **Configure Webhook Events:**
   - In Stripe Dashboard, select these events:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

4. **Deploy Functions:**
   ```bash
   cd client/functions
   firebase deploy --only functions:stripeWebhook
   ```

5. **Test Webhook:**
   - Use Stripe CLI for local testing:
     ```bash
     stripe listen --forward-to http://localhost:5001/parking-app-1cb84/us-central1/stripeWebhook
     ```
   - Or test with a real payment in test mode

---

## Firestore Indexes Needed

You may need to create these indexes in Firebase Console:

1. **payments collection:**
   - `user_id` (Ascending) + `created_at` (Descending)
   - `session_id` (Ascending)

2. **bookings collection:**
   - `user_id` (Ascending) + `booked_at` (Descending)
   - `user_id` (Ascending) + `status` (Ascending) + `session_id` (Ascending)

Firebase will show a link to create indexes when you run queries that need them.

---

## Common Issues & Solutions

### Issue: Payment record not created
**Solution:** 
- Check console logs in `startCheckout()`
- Verify user is logged in
- Check Firestore security rules

### Issue: Billing history empty
**Solution:**
- Verify payments exist in `payments` collection
- Check `user_id` matches current user
- Verify security rules allow reading

### Issue: "View on Map" doesn't work
**Solution:**
- Ensure booking has `spot_latitude` and `spot_longitude`
- Check navigation parameters are passed correctly
- Verify `homePage` handles `bookingLocation` parameter

### Issue: Booking not appearing
**Solution:**
- Check `getUserBookings()` function
- Verify booking has correct `user_id`
- Check Firestore security rules

---

## Testing Checklist

- [ ] Payment record created before checkout
- [ ] Billing history displays payments from payments collection
- [ ] Bookings screen displays bookings correctly
- [ ] "View on Map" button navigates to map
- [ ] Map centers on booking location
- [ ] Payment helper functions work
- [ ] Security rules prevent unauthorized access
- [ ] Fallback booking creation works (if webhook not available)

---

## Next Steps After Webhook Setup

Once webhook is configured:
1. Test complete payment flow
2. Verify automatic booking creation
3. Test payment status updates
4. Test failed payment handling
5. Verify idempotency (duplicate webhook events)

---

## Notes

- All payment amounts are stored in **cents** in the database
- Display amounts are converted to regular currency (divided by 100)
- Currency is stored as lowercase ('usd') but displayed as uppercase ('USD')
- Timestamps use Firestore `serverTimestamp()` for consistency
- The webhook handler is idempotent (can handle duplicate events safely)

