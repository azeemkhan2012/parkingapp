const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const stripeLib = require("stripe");

initializeApp();

// Define secret (new system)
const STRIPE_SECRET = defineSecret("STRIPE_SECRET");

exports.createPaymentIntent = onCall(
  { secrets: [STRIPE_SECRET] },
  async (request) => {
    try {
      const { amount } = request.data;

      const stripe = stripeLib(STRIPE_SECRET.value());

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        automatic_payment_methods: { enabled: true }
      });

      return { clientSecret: paymentIntent.client_secret };
    } catch (err) {
      return { error: err.message };
    }
  }
);
