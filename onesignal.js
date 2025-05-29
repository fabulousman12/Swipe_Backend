const axios = require('axios');

const oneSignalClient = axios.create({
  baseURL: 'https://onesignal.com/api/v1',
  headers: {
    'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Now you can export and reuse oneSignalClient throughout your app
module.exports.oneSignalClient = oneSignalClient;
