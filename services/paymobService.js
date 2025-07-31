const axios = require("axios");
const API = 'https://accept.paymob.com/api';

// 1️⃣ Authenticate with Paymob to get an auth_token

exports.authenticate = async () => {
    const { data } = await axios.post(`${API}/auth/tokens`, {
        api_key: process.env.PAYMOB_API_KEY
    })
    return data.token;
}

// 2️⃣ Create an order in Paymob system

exports.createOrder = async (token, amount, merchantOrderId) => {
    const { data } = await axios.post(`${API}/ecommerce/orders`, {
        auth_token: token,
        delivery_needed: false,
        amount_cents: amount * 100, // Paymob uses cents (e.g., 1000 EGP = 100000)
        currency: "EGP",
        merchant_order_id: merchantOrderId, // We'll use our Firestore booking ID
        items: [],
    });
    return data;
}

// 3️⃣ Generate payment key for user to complete payment

exports.generatePaymentKey = async ({ token, amount, orderId, userData }) => {
    const billingData = {
        apartment: "NA",
        email: userData.email,
        floor: "NA",
        first_name: userData.firstName,
        street: "NA",
        building: "NA",
        phone_number: userData.phone,
        shipping_method: "NA",
        postal_code: "NA",
        city: "Cairo",
        country: "EG",
        last_name: userData.lastName,
        state: "NA",
    }
    const { data } = await axios.post(`${API}/acceptance/payment_keys`, {
        auth_token: token,
        amount_cents: amount * 100,
        expiration: 3600,
        order_id: orderId,
        billing_data: billingData,
        currency: "EGP",
        integration_id: process.env.PAYMOB_INTEGRATION_ID,

    })
    return data.token;

}