const mongoose = require('mongoose');

// Define the schema for message updates
const messageUpdateSchema = new mongoose.Schema({
  messageIds: {
    type: [String], // Array of message IDs
    required: true, // Make this field required
    // Reference to the Message model
  },
  type: {
    type: String,
    required: true, // Type of the update (e.g., "status update")
    enum: ['status update', 'read receipt', 'other'] // Enum for possible update types (you can modify as per your use case)
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId, // The recipient's user ID
    required: true,
    ref: 'User' // Reference to the User model
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId, // The recipient's user ID
    required: true,
    ref: 'User' // Reference to the User model
  },
  timestamp: {
    type: Date,
    default: Date.now // Timestamp of when the update is made
  }
});

// Create a Mongoose model using the schema
const MessageUpdate = mongoose.model('MessageUpdate', messageUpdateSchema);

module.exports = MessageUpdate;
