const express = require('express');
const router = express.Router();
const mysqlPromisePool = require('../Mydb.js'); // Adjust the path as per your project structure
const fetchuser = require('../middleware/fetchuser');
const axios = require('axios');

// mark read messages


router.post('/mark-read', fetchuser, async (req, res) => {
  try {
    const userId = req.user.id; // Current user ID from fetchuser middleware
    let { messageIds } = req.body; // Message IDs to mark as read

    // Ensure messageIds is an array
    if (typeof messageIds === 'string') {
      // Single ID case: Convert to an array with one element
      messageIds = [messageIds];
    } else if (!Array.isArray(messageIds)) {
      // If messageIds is not an array or string, return an error
      return res.status(400).json({ error: 'Invalid message IDs format' });
    }
console.log(messageIds)
    // Convert all message IDs to strings and filter out any empty or invalid IDs
    messageIds = messageIds.map(id => String(id).trim()).filter(id => id !== '');

    if (messageIds.length === 0) {
      return res.status(200).json({ message: 'No message IDs provided' });
    }

    // Construct the query with placeholders
    const placeholders = messageIds.map(() => '?').join(',');
    const updateQuery = `
      UPDATE messages
      SET \`read\` = 1
      WHERE recipient = ? AND id IN (${placeholders})
    `;
    const queryParams = [userId, ...messageIds];

    // Execute the query
    const [updateResult] = await mysqlPromisePool.promise().query(updateQuery, queryParams);

    res.json({ success: true, updatedCount: updateResult.affectedRows });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.post('/uploadsignurl', fetchuser, async (req, res) => {
  const userId = req.user.id;
  const B2_ACCOUNT_ID = process.env.B2_ACCOUNT_ID;
  const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY;
  const B2_BUCKET_ID = process.env.B2_BUCKET_ID;

  const { filename, fileSize } = req.body;
  if (!filename || !fileSize) {
    return res.status(400).json({ error: 'Filename and fileSize are required' });
  }

  // ✅ Step 1: Get B2 authorization
  async function getB2AuthToken() {
    const credentials = Buffer.from(`${B2_ACCOUNT_ID}:${B2_APPLICATION_KEY}`).toString('base64');

    const authResponse = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: {
        Authorization: `Basic ${credentials}`
      }
    });

    return authResponse.data;
  }

  // ✅ Step 2: Get Upload URL
  async function getSignedUrl(filename, fileSize) {
    try {
      const authTokenData = await getB2AuthToken();
      const { authorizationToken, apiUrl } = authTokenData;

      const uploadUrlResponse = await axios.post(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
        bucketId: B2_BUCKET_ID
      }, {
        headers: {
          Authorization: authorizationToken
        }
      });

      const { uploadUrl, authorizationToken: uploadAuthorizationToken } = uploadUrlResponse.data;

      return {
        uploadUrl,
        uploadAuthorizationToken,
        filename,
        fileSize
      };

    } catch (error) {
      console.error('Error getting signed URL:', error.response?.data || error.message);
      throw error;
    }
  }

  try {
    const signedUrlData = await getSignedUrl(filename, fileSize);
    res.json(signedUrlData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

module.exports = router;


router.post('/history', fetchuser, async (req, res) => {
  try {
    const userId = req.user.id; // Current user ID from fetchuser middleware
    const recipientId = req.body.recipientId; // Recipient ID from request body
    const page = parseInt(req.body.page) || 1; // Current page number, default to 1
    const limit = parseInt(req.body.limit) || 30; // Number of messages per page, default to 30

    // Fetch messages from MySQL where current user is either sender or recipient, with pagination
    const query = `
      SELECT *
      FROM messages
      WHERE (sender = ? AND recipient = ?)
        OR (sender = ? AND recipient = ?)
      ORDER BY timestamp DESC
      LIMIT ?
      OFFSET ?;
    `;
    const offset = (page - 1) * limit;
    const [messages] = await mysqlPromisePool.promise().query(query, [userId, recipientId, recipientId, userId, limit, offset]);

    // Check if any messages have status pending, if so change to sent
    const pendingMessageIds = messages
      .filter(message => message.status === 'pending')
      .map(message => message.id);

    if (pendingMessageIds.length > 0) {
      const updatePendingQuery = `
        UPDATE messages
        SET status = 'sent'
        WHERE id IN (?);
      `;
      await mysqlPromisePool.promise().query(updatePendingQuery, [pendingMessageIds]);
    }

    // Mark unread messages as read
    const unreadMessageIds = messages
      .filter(message => !message.read && message.recipient === userId)
      .map(message => message.id);

    if (unreadMessageIds.length > 0) {
      const updateReadQuery = `
        UPDATE messages
        SET \`read\` = 1
        WHERE recipient = ? AND id IN (?);
      `;
      await mysqlPromisePool.promise().query(updateReadQuery, [userId, unreadMessageIds]);
    }

    res.json(messages);
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
