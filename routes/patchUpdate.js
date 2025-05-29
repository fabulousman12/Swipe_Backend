const express = require('express');
const router = express.Router();

const version = '1.0.0'; // Replace with your actual version number

// Your other routes and middleware

// Endpoint to get the current version
router.get('/api/version', (req, res) => {
  res.json({ version });
});


module.exports = router;

 // Main server port
