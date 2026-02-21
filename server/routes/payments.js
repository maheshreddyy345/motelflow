const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');

// Initialize Stripe with secret key (gracefully handle missing key)
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized');
} else {
    console.warn('⚠️  STRIPE_SECRET_KEY not set — payment routes will be unavailable');
}

// All payment routes require auth
const paymentAuth = [auth, authorize('owner', 'manager', 'frontdesk')];

// GET /api/payments/config — Return publishable key to frontend
router.get('/config', auth, async (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
});

// POST /api/payments/create-intent — Create a Stripe PaymentIntent
router.post('/create-intent', ...paymentAuth, async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.' });
        }
        const { amount, reservationId, guestName, confirmationNumber } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        // Stripe expects amounts in cents
        const amountInCents = Math.round(parseFloat(amount) * 100);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                reservationId: String(reservationId || ''),
                confirmationNumber: confirmationNumber || '',
                guestName: guestName || '',
                source: 'motel-flow-pms',
            },
            description: `Motel Flow - ${confirmationNumber || 'Payment'} - ${guestName || 'Guest'}`,
        });

        console.log(`💳 PaymentIntent created: ${paymentIntent.id} for $${amount}`);

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        });
    } catch (error) {
        console.error('Create payment intent error:', error.message);

        // Return user-friendly Stripe errors
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to create payment. Check Stripe configuration.' });
    }
});

module.exports = router;
