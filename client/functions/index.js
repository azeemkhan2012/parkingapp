// const { onCall } = require("firebase-functions/v2/https");
// const { defineSecret } = require("firebase-functions/params");
// const stripeLib = require("stripe");
// const { initializeApp } = require("firebase-admin/app");

// initializeApp();

// const STRIPE_SECRET = defineSecret("STRIPE_SECRET");

// exports.createPaymentIntent = onCall(
//   { secrets: [STRIPE_SECRET] },
//   async (request) => {
//     try {
//       const { amount, currency } = request.data;

//       if (!amount || typeof amount !== "number") {
//         throw new Error("Amount is required and must be a number (in smallest currency unit)");
//       }

//       const stripe = stripeLib(STRIPE_SECRET.value());

//       const paymentIntent = await stripe.paymentIntents.create({
//         amount,
//         currency: currency || "usd", // fallback to usd
//         automatic_payment_methods: { enabled: true },
//       });

//       return { clientSecret: paymentIntent.client_secret };
//     } catch (err) {
//       console.error("createPaymentIntent error:", err);
//       return { error: err.message };
//     }
//   }
// );

const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const stripeLib = require('stripe');
const {initializeApp} = require('firebase-admin/app');

initializeApp();

// Secret from Firebase console → Build → Secrets
const STRIPE_SECRET = defineSecret('STRIPE_SECRET');

exports.createCheckoutSession = onRequest(
  {secrets: [STRIPE_SECRET]},
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method not allowed'});
      }

      const {amount, userId, spotId, name} = req.body;

      if (!amount || !spotId) {
        return res.status(400).json({error: 'Missing amount or spotId'});
      }

      const stripe = stripeLib(STRIPE_SECRET.value());

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'PKR', // Stripe doesn't support PKR
              product_data: {
                name: name,
                metadata: {spotId},
              },
              unit_amount: amount, // cents
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: userId || 'guest',
          spotId,
        },
        success_url:
          'parkingapp://checkout/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'parkingapp://checkout/cancel',
      });

      return res.json({url: session.url});
    } catch (err) {
      console.error('createCheckoutSession error:', err);
      return res.status(500).json({error: err.message});
    }
  },
);

exports.verifyCheckoutSession = onRequest(
  {secrets: [STRIPE_SECRET]},
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method not allowed'});
      }

      const {sessionId} = req.body;
      if (!sessionId) {
        return res.status(400).json({error: 'sessionId required'});
      }

      const stripe = stripeLib(STRIPE_SECRET.value());

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });

      const paid = session.payment_status === 'paid';

      res.json({
        paid,
        spotId: session.metadata?.spotId || null,
        userId: session.metadata?.userId || null,
      });
    } catch (err) {
      console.error('verifyCheckoutSession error:', err);
      res.status(500).json({error: err.message});
    }
  },
);
