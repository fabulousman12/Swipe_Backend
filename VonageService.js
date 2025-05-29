// Correct import from @vonage/server-sdk
const { Vonage } = require('@vonage/server-sdk');
const axios = require('axios');



// Function to send OTP
const sendOtp = async (phoneNumber, otpCode) => {
    // Remove '+' if present
      const countryCode = '91';

  let sanitizedNumber = phoneNumber.replace('+', '');
  if (sanitizedNumber.startsWith(countryCode)) {
    sanitizedNumber = sanitizedNumber.slice(countryCode.length);
  }
  const API_KEY = process.env.Renflair_API_KRY; // Replace with actual key

  const url = `https://whatsapp.renflair.in/V1.php?API=${API_KEY}&PHONE=${sanitizedNumber}&OTP=${otpCode}&COUNTRY=${countryCode}`;

  try {
    console.log('Sending OTP to:', sanitizedNumber);

    const response = await axios.get(url); // Using GET to match PHP behavior

    console.log('OTP sent successfully:', response.data.message);
    return response.data;
  } catch (error) {
    console.error('Error sending OTP:', error.response?.data || error.message );
        if (
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('timeout') ||
      error.message?.includes('connect') ||
      error.message?.includes('AggregateError')
    ) {
      // Simulate a failed response with SMS BALANCE UNAVAILABLE
      return {
        status: 'FAILED',
        message: 'SMS BALANCE UNAVAILABLE',
      };
    }
    throw error;
  }
};

module.exports = { sendOtp };
