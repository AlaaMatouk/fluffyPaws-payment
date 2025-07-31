const admin = require('firebase-admin');
const serviceAccount = require('../firebaseKey.json.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
module.exports = db;