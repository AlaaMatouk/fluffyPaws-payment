const express = require("express");
const router = express.Router();

const {
  createPaymentSession,
  handleWebhook,
  updateBookingStatus,
} = require("../controllers/paymobController");
// Booking → Payment flow
router.post("/pay", createPaymentSession);

// Paymob webhook after payment completes
router.post("/webhook", handleWebhook);

// Shelter/Org updates booking approval status
router.patch("/bookings/:id/status", updateBookingStatus);
module.exports = router;
