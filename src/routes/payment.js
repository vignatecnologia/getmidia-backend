const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Create Checkout Preference
router.post('/create-checkout', authMiddleware, async (req, res) => {
    const { planId } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    const plans = {
        'essential': { title: 'Plano Essencial', price: 89.90, credits: 80 },
        'advanced': { title: 'Plano Avançado', price: 129.90, credits: 120 },
        'professional': { title: 'Plano Profissional', price: 189.90, credits: 200 }
    };

    const plan = plans[planId];
    if (!plan) return res.status(400).json({ error: 'Plano inválido' });

    try {
        const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

        const preference = {
            items: [{
                id: planId,
                title: plan.title,
                unit_price: Number(plan.price),
                quantity: 1,
                currency_id: 'BRL'
            }],
            payer: { email: userEmail },
            metadata: {
                user_id: userId,
                plan_id: planId,
                credits: plan.credits
            },
            back_urls: {
                success: 'https://getmidia.com.br/dashboard?payment=success',
                failure: 'https://getmidia.com.br/dashboard?payment=failure',
                pending: 'https://getmidia.com.br/dashboard?payment=pending'
            },
            auto_return: 'approved',
            notification_url: 'https://api.getmidia.com.br/api/payments/webhook'
        };

        const response = await axios.post('https://api.mercadopago.com/checkout/preferences', preference, {
            headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` }
        });

        res.json({ init_point: response.data.init_point });
    } catch (err) {
        console.error("CHECKOUT ERROR:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/webhook', async (req, res) => {
    const { type, action, data } = req.body;
    const id = data?.id || req.query.id;
    const topic = type || action || req.query.topic;

    console.log(`Webhook received: ${topic} - ID: ${id}`);

    if (!id) {
        return res.status(200).json({ message: "No ID found" });
    }

    // Handle Mercado Pago Test Event
    if (id === "123456") {
        return res.status(200).json({ message: "Test Event Received" });
    }

    try {
        if (topic === 'payment' || req.query.type === 'payment') {
            const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

            const response = await axios.get(`https://api.mercadopago.com/v1/payments/${id}`, {
                headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` }
            });

            const paymentData = response.data;

            if (paymentData.status === 'approved') {
                const userId = paymentData.metadata.user_id;
                const creditsToAdd = Number(paymentData.metadata.credits);

                if (userId && creditsToAdd) {
                    console.log(`✅ Approved Payment: Adding ${creditsToAdd} credits to user ${userId}`);

                    // Update credits
                    await pool.query(
                        'UPDATE profiles SET credits = credits + ? WHERE id = ?',
                        [creditsToAdd, userId]
                    );

                    // Handle Subscription (if plan_id exists)
                    const planId = paymentData.metadata.plan_id;
                    if (planId) {
                        const now = new Date();
                        const nextMonth = new Date(now);
                        nextMonth.setDate(nextMonth.getDate() + 30);

                        await pool.query(
                            'UPDATE profiles SET plan_id = ?, subscription_status = "active", subscription_start = ?, subscription_end = ? WHERE id = ?',
                            [planId, now, nextMonth, userId]
                        );
                    }
                }
            }
        }

        res.status(200).json({ message: "Webhook processed" });
    } catch (err) {
        console.error("WEBHOOK ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
