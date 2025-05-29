// models/group.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const groupSchema = new Schema({
  name: { type: String, required: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  profilePhoto: { data: Buffer, contentType: String}
});

module.exports = mongoose.model('Group', groupSchema);
