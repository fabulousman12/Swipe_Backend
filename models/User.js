const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: 'Name is required'
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  profilePhoto: {
    data: Buffer,
    contentType: String
  },
  contacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  device_token_fcm: {
    type: String,
    unique: true,
    sparse: true  // allows multiple docs with null
  },
  device_token_pushy: {
    type: String,
    unique: true,
    sparse: true
  },
  
  About: {
    type: String
  },

  // ✅ Newly added fields:
  gender: {
    type: String,
    enum: ['male', 'female', 'other', ''], // optional enum
    default: ''
  },
  dob: {
    type: Date,
  },
  location: {
    type: String,
    default: ''
  }

}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ notification_Token: 1 });

module.exports = mongoose.model("User", userSchema);
