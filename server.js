const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

dotenv.config();


const app = express();
app.use(cors());
app.use(bodyParser.json());

const paymobRoutes = require('./routes/paymobRoutes');
app.use("/api/paymob", paymobRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
