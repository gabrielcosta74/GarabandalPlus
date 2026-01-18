import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    console.warn("⚠️ STRIPE_SECRET_KEY missing. Payments will fail.");
}

export const stripe = new Stripe(stripeSecretKey || '', {
    apiVersion: '2024-04-10', // Use latest supported/installed
    typescript: true,
});
