const express = require('express');
const router = express.Router();


const{createPaymentSession, handleWebhook} = require("../controllers/paymobController");

// Booking → Payment flow
router.post("/pay", createPaymentSession);

// Paymob webhook after payment completes
router.post("/webhook", handleWebhook);

module.exports = router;
