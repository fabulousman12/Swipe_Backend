const mongoose = require('mongoose');

// Define the file schema
const fileSchema = new mongoose.Schema({
  sender: {
    type: String,  // User ID of the sender
    required: true,
  },
  recipient: {
    type: String,  // User ID of the recipient
    required: true,
  },
  fileId: {
    type: String,  // User ID of the recipient
    required: true,
      
  },
  fileData: {
    type: Buffer,  // The actual file data (in binary form)
    required: true,
  },
  fileName: {
    type: String,  // The name of the file
    required: true,
  },
  fileType: {
    type: String,  // The type of file (image, video, pdf, etc.)
    required: true,
  },
  status: {
    type: String,  // The status of the file transfer (e.g., 'pending', 'sent', 'delivered')
    enum: ['pending', 'sent', 'delivered'],
    default: 'pending',
  },
  thumbnail: {
    type: String,  // Path to the generated thumbnail (if applicable)
    default: null,
  },
  timestamp: {
    type: Date,  // Timestamp when the file was uploaded
    default: Date.now,
  },
  totalChunks: {
    type: Number,  // Total number of chunks the file is split into (if it's a large file)
    default: 0,
  },
  currentChunk: {
    type: Number,  // The current chunk number of the file (for tracking)
    default: 0,
  },
  isCompleted: {
    type: Boolean,  // Whether the entire file transfer has been completed
    default: false,
  },
  read: { type: Number, default: 0 },
});

// Create a model for the file schema
const File = mongoose.model('File', fileSchema);

module.exports = File;
