const admin = require("firebase-admin");
require("dotenv").config();

if (!process.env.FIREBASE_KEY_JSON) {
  throw new Error("Missing FIREBASE_KEY_JSON in environment variables");
}

let serviceAccount;
serviceAccount = JSON.parse(process.env.FIREBASE_KEY_JSON);

serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
module.exports = db;
