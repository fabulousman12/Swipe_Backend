const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'sent','delivered'], default: 'pending' },
  read: { type: Boolean, default: false },
 
});

module.exports = mongoose.model('Message', messageSchema);
