const admin = require("firebase-admin");
const db = require("../utils/firestore"); // your initialized admin.firestore() instance
const {
  authenticate,
  createOrder,
  generatePaymentKey,
} = require("../services/paymobService");

// Helper: convert date-like value (ISO string or Date) to Firestore Timestamp
const toTs = (v) =>
  v ? admin.firestore.Timestamp.fromDate(new Date(v)) : null;

exports.createPaymentSession = async (req, res) => {
  console.log("📨 create session:", req.body);

  try {
    const { userId, shelterId, amount, userData, bookingData = {} } = req.body;
    const { firstName = "", lastName = "", email = "", phone = "" } = userData;
    // 1) Create the booking document before payment (source of truth)
    //    - Keep original bookingData for backward-compat
    //    - Flatten key fields with proper types for efficient queries
    const bookingRef = await db.collection("bookings").add({
      userId,
      shelterId,
      amount,
      currency: "EGP",
      paymentStatus: "pending", // keep "pending" to avoid breaking existing logic
      createdAt: admin.firestore.FieldValue.serverTimestamp(),

      // keep the full blob if some UI reads from it
      bookingData,

      // flattened, query-friendly fields
      location: bookingData.location ?? null,
      fromDate: toTs(bookingData.fromDate),
      toDate: toTs(bookingData.toDate),
      nights: bookingData.nights ?? null, // duration
      petCount: bookingData.petCount ?? null,
      petIds: Array.isArray(bookingData.petIds) ? bookingData.petIds : [],
      pets: Array.isArray(bookingData.pets) ? bookingData.pets : [], // lightweight pet snapshots

      //  minimal customer snapshot
      customer: {
        firstName,
        lastName,
        email,
        phone,
      },
    });

    // 2) Paymob: merchant_order_id MUST equal bookingRef.id (so webhook can map back)
    const token = await authenticate();
    const order = await createOrder(token, amount, bookingRef.id);

    // persist Paymob's numeric order id for reference/fallback
    await bookingRef.update({ orderId: order.id });

    // 3) Generate payment key and return iframe URL
    const paymentToken = await generatePaymentKey({
      token,
      amount,
      orderId: order.id,
      userData,
    });

    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;

    return res.json({ iframeUrl });
  } catch (error) {
    console.error("createPaymentSession error:", error);
    return res.status(500).json({ message: "Failed to initiate payment." });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    // If you enable HMAC, validate raw body here before parsing.
    const payload = req.body;
    const obj = payload.obj || payload;

    const success = obj?.success === true;

    // Identifiers
    const orderId = obj?.order?.id || null; // Paymob numeric order id
    const merchantOrderId =
      obj?.order?.merchant_order_id || obj?.merchant_order_id || null; // our bookingId

    // Fields to persist
    const update = {
      paymentStatus: success ? "paid" : "failed",
      paidAt: success ? admin.firestore.FieldValue.serverTimestamp() : null,
      transactionId: obj?.id || null,
      orderId,
      amount:
        typeof obj?.amount_cents === "number" ? obj.amount_cents / 100 : null,
    };

    let bookingRef = null;

    // Prefer mapping by merchant_order_id (bookingId)
    if (merchantOrderId) {
      const byId = db.collection("bookings").doc(merchantOrderId);
      const snap = await byId.get();
      if (snap.exists) bookingRef = byId;
    }

    // Fallback: locate by orderId (legacy)
    if (!bookingRef && orderId) {
      const qs = await db
        .collection("bookings")
        .where("orderId", "==", orderId)
        .limit(1)
        .get();
      if (!qs.empty) bookingRef = qs.docs[0].ref;
    }

    if (!bookingRef) {
      console.warn("Webhook: booking not found", { merchantOrderId, orderId });
      return res.sendStatus(404);
    }

    await bookingRef.set(update, { merge: true });
    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    return res.sendStatus(500);
  }
};
