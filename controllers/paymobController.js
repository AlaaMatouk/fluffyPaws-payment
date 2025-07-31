const db = require("../utils/firestore");

const { authenticate,
    createOrder,
    generatePaymentKey,
} = require('../services/paymobService')

exports.createPaymentSession = async (req, res) => {
    console.log("📨 create session:", req.body);

    try {
        const { userId, shelterId, amount, userData } = req.body;
        const bookingRef = await db.collection("bookings").add({
            userId,
            shelterId,
            amount,
            paymentStatus: "pending",
            createdAt: new Date()
        })

        const token = await authenticate();

        const order = await createOrder(token, amount, bookingRef.id);


        await bookingRef.update({ orderId: order.id });

        const paymentToken = await generatePaymentKey({
            token,
            amount,
            orderId: order.id,
            userData
        })
        const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
        // Return it to frontend so user can be redirected to Paymob page
        res.json({ iframeUrl });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Failed to initiate payment." })
    }
}



// 2️⃣ Handle Paymob webhook: called by Paymob after payment success/failure

exports.handleWebhook = async (req, res) => {
    console.log("📨 Webhook received from Paymob:", req.body);

    try {
        const { obj } = req.body;

        const orderId = obj.order.id;
        const success = obj.success;

        const bookingsRef = db.collection("bookings");
        const snapshot = await bookingsRef.where("orderId", '==', orderId).limit(1).get();
        // If no matching booking found, exit early
        if (snapshot.empty) return res.sendStatus(404);
        const doc = snapshot.docs[0];
        // Update booking status based on payment result
        const status = success ? "paid" : "failed";
        await doc.ref.update({ paymentStatus: status });
        res.sendStatus(200);
    } catch (error) {
        console.error("Webhook error:", error);
        res.sendStatus(500);

    }
}