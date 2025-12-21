const mongoose = require('mongoose');

const excelReadingSchema = new mongoose.Schema({
  customer: String,
  oldMeter: Number,
  newMeter: Number,
  usage: Number,
  amount: Number,
  chatId: Number,
  username: String,
  GroupName: String,
  status: { type: String, default: 'pending', index: true },
  lastSent: Date,
  lastError: String,
  lastTriedAt: Date,
  sendAttempts: { type: Number, default: 0},
  lastGeneratedAt: Date,
  pdfFile: String,
  failureReason: String
}); 

module.exports = mongoose.model('excelreading', excelReadingSchema);
