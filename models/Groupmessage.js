// models/GroupMessage.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const groupMessageSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'sent', 'delivered', 'read'], default: 'pending' },
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }]  // Array to track users who have read the message
});

module.exports = mongoose.model('GroupMessage', groupMessageSchema);
