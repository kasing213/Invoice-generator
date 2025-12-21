// backfill.js
const mongoose = require('mongoose');
const ExcelReading = require('./models/excelReading');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGO_URL);

  const res = await ExcelReading.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'pending' } }
  );

  console.log(`✅ Backfilled missing statuses → ${res.modifiedCount} updated`);
  await mongoose.disconnect();
})();
