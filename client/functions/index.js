// functions/index.js

const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

// 🔐 Load secret stored in Secret Manager
const STRIPE_SECRET = defineSecret('stripe_secret_key');

// Initialize Firebase
admin.initializeApp();

// Callable Cloud Function
exports.createPaymentIntent = onCall(
  {secrets: [STRIPE_SECRET]},
  async request => {
    try {
      console.log(STRIPE_SECRET, 'STRIPE_SECRET');

      const secret = STRIPE_SECRET.value();

      if (!secret) {
        throw new HttpsError(
          'failed-precondition',
          'Stripe secret key is missing.',
        );
      }

      const stripe = Stripe(secret);

      const {
        amount,
        currency = 'usd',
        paymentMethodTypes = ['card'],
      } = request.data || {};

      if (!amount) {
        throw new HttpsError('invalid-argument', 'Amount is required.');
      }

      const uid = request.auth?.uid || 'guest';

      const paymentIntent = await stripe.paymentIntents.create({
        amount: parseInt(amount, 10),
        currency,
        payment_method_types: paymentMethodTypes,
        metadata: {uid},
      });

      return {
        clientSecret: paymentIntent.client_secret,
      };
    } catch (err) {
      console.error('Error creating Payment Intent:', err);
      throw new HttpsError('internal', err.message);
    }
  },
);
