// otpController.js
const twilio = require('twilio');
const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  try {
    const verification = await client.verify.services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications
      .create({ to: phoneNumber, channel: 'sms' });

    res.status(200).json({ success: true, message: 'OTP sent successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send OTP', error });
  }
};

const verifyOtp = async (req, res) => {
  const { phoneNumber, otp } = req.body;
  try {
    const verificationCheck = await client.verify.services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks
      .create({ to: phoneNumber, code: otp });

    if (verificationCheck.status === 'approved') {
      res.status(200).json({ success: true, message: 'OTP verified successfully!' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'OTP verification failed', error });
  }
};

module.exports = { sendOtp, verifyOtp };
