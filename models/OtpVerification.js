// models/OtpVerification.js
const mongoose = require('mongoose');

const OtpVerificationSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true },
  otpCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '10m' }  // TTL index, expires after 10 minutes
});

module.exports = mongoose.model('OtpVerification', OtpVerificationSchema);
