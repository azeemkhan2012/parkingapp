const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const stripeLib = require('stripe');
const { initializeApp } = require('firebase-admin/app');

initializeApp();

const STRIPE_SECRET = defineSecret('STRIPE_SECRET');

exports.createCheckoutSession = onRequest(
  { secrets: [STRIPE_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { amount, userId, spotId, name, email } = req.body;

      if (!amount || !spotId) {
        return res.status(400).json({ error: 'Missing amount or spotId' });
      }

      const stripe = stripeLib(STRIPE_SECRET.value());

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',

        // Pre-fill email on Stripe checkout
        customer_email: email || undefined,

        line_items: [
          {
            price_data: {
              currency: 'PKR', // FIX: Stripe does NOT support PKR
              product_data: {
                name: name || 'Parking Spot Booking',
              },
              unit_amount: amount, // must be >= 50 cents ($0.50)
            },
            quantity: 1,
          },
        ],

        // Your useful metadata
        metadata: {
          userId: userId || 'guest',
          spotId,
        },

        success_url:
          'parkingapp://checkout/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'parkingapp://checkout/cancel',
      });

      return res.json({ url: session.url });
    } catch (err) {
      console.error('createCheckoutSession error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
);

exports.verifyCheckoutSession = onRequest(
  { secrets: [STRIPE_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required' });
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
        email: session.customer_email || null,
        amount: session.amount_total ? session.amount_total / 100 : null, // Convert cents to regular amount
        currency: session.currency || 'PKR',
      });
    } catch (err) {
      console.error('verifyCheckoutSession error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);
