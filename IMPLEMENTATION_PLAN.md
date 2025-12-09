# Payment History & Booking Confirmation Implementation Plan

## Overview
This document outlines the step-by-step implementation plan for:
1. Creating a dedicated `payments` collection for payment history
2. Setting up Stripe webhook handler for reliable payment confirmation
3. Creating confirmed bookings after successful payment
4. Adding navigation from bookings list to map

## Current State Analysis

### Existing Implementation
- ✅ Stripe checkout session creation (`createCheckoutSession`)
- ✅ Payment verification (`verifyCheckoutSession`)
- ✅ Booking creation in `bookings` collection (client-side after payment)
- ✅ Billing history screen (reads from `bookings` collection)
- ✅ Bookings screen (shows user bookings)

### Current Flow
1. User clicks "Book Now" → Creates Stripe checkout session
2. User completes payment → Redirects to app with `session_id`
3. App verifies payment → Calls `bookParkingSpot()` to create booking
4. Navigates to confirmation screen

### Issues with Current Implementation
- ❌ No webhook handler (unreliable if app doesn't handle deep link)
- ❌ No dedicated payments collection (payment history mixed with bookings)
- ❌ Booking creation happens client-side (can fail if app crashes)
- ❌ No navigation from bookings to map

---

## Implementation Steps

### **STEP 1: Create Payments Collection Structure**

**Goal:** Create a dedicated `payments` collection to track all payment transactions separately from bookings.

**Tasks:**
1. Design payment document schema
2. Update Firestore security rules for `payments` collection
3. Create helper functions in `firebase.js` to interact with payments collection

**Payment Document Schema:**
```javascript
{
  user_id: string,              // Firebase user ID
  booking_id: string | null,    // Reference to booking (null if payment failed)
  spot_id: string,              // Parking spot ID
  session_id: string,           // Stripe checkout session ID
  payment_intent_id: string,    // Stripe payment intent ID
  amount: number,               // Amount in cents
  currency: string,              // Currency code (e.g., 'usd', 'pkr')
  status: string,               // 'pending', 'succeeded', 'failed', 'refunded'
  payment_method: string,       // 'stripe'
  stripe_customer_id: string | null,
  metadata: object,             // Additional Stripe metadata
  created_at: timestamp,        // When payment was initiated
  paid_at: timestamp | null,    // When payment was completed
  refunded_at: timestamp | null // When payment was refunded
}
```

**Deliverables:**
- Updated `firestore.rules` with payments collection rules
- New functions in `firebase.js`: `createPaymentRecord()`, `updatePaymentStatus()`, `getUserPayments()`
- Test: Create a payment record manually and verify it appears

---

### **STEP 2: Create Stripe Webhook Handler**

**Goal:** Set up a reliable server-side webhook handler to process Stripe payment events and create bookings automatically.

**Tasks:**
1. Create webhook endpoint in Firebase Functions
2. Handle Stripe webhook events:
   - `checkout.session.completed` - Payment successful, create booking
   - `payment_intent.succeeded` - Payment confirmed
   - `payment_intent.payment_failed` - Payment failed
3. Verify webhook signature for security
4. Create payment record in `payments` collection
5. Create/update booking in `bookings` collection

**Webhook Events to Handle:**
- `checkout.session.completed` - Main event for successful payment
- `payment_intent.succeeded` - Backup confirmation
- `payment_intent.payment_failed` - Handle failures

**Deliverables:**
- New Firebase Function: `stripeWebhook`
- Webhook signature verification
- Automatic booking creation on successful payment
- Payment record creation
- Test: Use Stripe CLI to send test webhook events

---

### **STEP 3: Update Payment Flow to Create Payment Records**

**Goal:** Update the client-side payment flow to create payment records before checkout.

**Tasks:**
1. Modify `startCheckout()` in `homePage.jsx` to create payment record
2. Update `handleCheckoutSuccess()` to update payment record status
3. Ensure payment records are created even if booking fails

**Deliverables:**
- Updated `homePage.jsx` with payment record creation
- Updated `App.tsx` with payment record update on success
- Test: Complete a payment and verify payment record is created

---

### **STEP 4: Update Billing History to Use Payments Collection**

**Goal:** Update billing history screen to read from `payments` collection instead of `bookings` collection.

**Tasks:**
1. Update `getBillingHistory()` function to query `payments` collection
2. Join payment data with booking data for complete information
3. Update `BillingHistoryScreen.jsx` to display payment-specific information

**Deliverables:**
- Updated `getBillingHistory()` function
- Updated `BillingHistoryScreen.jsx` component
- Test: View billing history and verify it shows payment records

---

### **STEP 5: Enhance Bookings Collection with Confirmation Status**

**Goal:** Ensure bookings collection properly tracks confirmed bookings with all necessary fields.

**Tasks:**
1. Review booking document schema
2. Ensure `status` field properly tracks: 'pending', 'confirmed', 'active', 'completed', 'cancelled'
3. Add `payment_id` reference to link booking with payment
4. Update webhook handler to set booking status to 'confirmed' on successful payment

**Booking Document Schema (Enhanced):**
```javascript
{
  user_id: string,
  spot_id: string,
  payment_id: string,           // Reference to payments collection
  status: string,               // 'pending', 'confirmed', 'active', 'completed', 'cancelled'
  spot_name: string,
  spot_address: string,
  spot_latitude: number,
  spot_longitude: number,
  amount: number,
  currency: string,
  payment_status: string,        // 'paid', 'pending', 'failed'
  payment_method: string,
  session_id: string,
  booked_at: timestamp,
  confirmed_at: timestamp,      // When payment was confirmed
  booking_start: timestamp,
  booking_end: timestamp | null
}
```

**Deliverables:**
- Updated booking schema documentation
- Webhook handler creates bookings with `status: 'confirmed'`
- Test: Verify confirmed bookings appear in bookings list

---

### **STEP 6: Add Navigation from Bookings to Map**

**Goal:** Allow users to navigate to a booking's location on the map from the bookings screen.

**Tasks:**
1. Add "View on Map" button to each booking card in `BookingsScreen.jsx`
2. Navigate to home page with booking location coordinates
3. Update home page to accept navigation parameters for booking location
4. Center map on booking location when navigated from bookings

**Deliverables:**
- Updated `BookingsScreen.jsx` with navigation button
- Updated `homePage.jsx` to handle booking location navigation
- Test: Click "View on Map" from bookings and verify map centers on location

---

### **STEP 7: Update Firestore Security Rules**

**Goal:** Add security rules for the new `payments` collection.

**Tasks:**
1. Add rules for `payments` collection
2. Users can read their own payments
3. Cloud Functions can create/update payments
4. Users cannot directly create/update payments (only via webhook)

**Deliverables:**
- Updated `firestore.rules` file
- Test: Verify users can read their own payments but not others

---

### **STEP 8: Testing & Validation**

**Goal:** Comprehensive testing of the entire payment and booking flow.

**Test Scenarios:**
1. **Happy Path:**
   - User books spot → Payment record created
   - User completes payment → Webhook creates booking
   - Payment record updated → Booking confirmed
   - User sees booking in bookings list
   - User can navigate to booking location on map
   - Payment appears in billing history

2. **Payment Failure:**
   - User starts checkout → Payment record created
   - Payment fails → Webhook updates payment status
   - No booking created
   - Payment appears in billing history with failed status

3. **Webhook Reliability:**
   - Test webhook with Stripe CLI
   - Verify booking created even if app doesn't handle deep link
   - Verify payment record updated correctly

4. **Edge Cases:**
   - Duplicate webhook events (idempotency)
   - Network failures during booking creation
   - Invalid payment data

**Deliverables:**
- Test results document
- Bug fixes for any issues found
- Updated documentation

---

## Technical Details

### Webhook Endpoint URL
```
https://us-central1-parking-app-1cb84.cloudfunctions.net/stripeWebhook
```

### Stripe Webhook Configuration
- Events to listen: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
- Webhook signing secret: Store in Firebase Secrets as `STRIPE_WEBHOOK_SECRET`

### Database Collections
1. **payments** - All payment transactions
2. **bookings** - All bookings (linked to payments)
3. **parking_spots** - Parking spot data (existing)

### Key Functions to Create/Update

**Firebase Functions:**
- `stripeWebhook` - Handle Stripe webhook events

**Client Functions (firebase.js):**
- `createPaymentRecord()` - Create payment record before checkout
- `updatePaymentStatus()` - Update payment status
- `getUserPayments()` - Get user's payment history
- `getBillingHistory()` - Updated to use payments collection

**Client Components:**
- `BookingsScreen.jsx` - Add navigation to map
- `BillingHistoryScreen.jsx` - Update to show payment data
- `homePage.jsx` - Handle booking location navigation

---

## Implementation Order

1. **Step 1** - Payments collection structure (Foundation)
2. **Step 2** - Webhook handler (Critical for reliability)
3. **Step 3** - Update payment flow (Client-side integration)
4. **Step 7** - Security rules (Security)
5. **Step 4** - Update billing history (UI update)
6. **Step 5** - Enhance bookings (Data integrity)
7. **Step 6** - Navigation to map (UX enhancement)
8. **Step 8** - Testing (Validation)

---

## Success Criteria

✅ All payments are recorded in `payments` collection
✅ Webhook reliably creates bookings on successful payment
✅ Billing history shows all payments from `payments` collection
✅ Bookings are properly linked to payments
✅ Users can navigate from bookings to map
✅ All security rules are properly configured
✅ All test scenarios pass

---

## Notes

- Stripe does not support PKR currency. Consider using USD or another supported currency.
- Webhook handler must be idempotent (handle duplicate events gracefully)
- Payment records should be created before checkout to track all payment attempts
- Consider adding retry logic for failed webhook processing

