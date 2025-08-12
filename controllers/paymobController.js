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
