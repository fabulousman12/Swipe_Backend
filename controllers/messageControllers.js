// controllers/messageController.js

const Message = require('../models/Message');
const PrivateChatroom = require('../models/PrivateChatroom');

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatroomId } = req.params;
    const { content } = req.body;

    // Check if the current user is a participant of the chatroom
    const chatroom = await PrivateChatroom.findById(chatroomId);
    if (!chatroom || !chatroom.participants.includes(userId)) {
      return res.status(403).json({ error: 'You are not authorized to send messages in this chatroom' });
    }

    // Create a new message
    const message = new Message({
      sender: userId,
      chatroom: chatroomId,
      content
    });

    await message.save();
    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Fetch message history for a chatroom
exports.getMessageHistory = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatroomId } = req.params;

    // Check if the current user is a participant of the chatroom
    const chatroom = await PrivateChatroom.findById(chatroomId);
    if (!chatroom || !chatroom.participants.includes(userId)) {
      return res.status(403).json({ error: 'You are not authorized to access messages in this chatroom' });
    }

    // Fetch message history for the chatroom
    const messages = await Message.find({ chatroom: chatroomId }).populate('sender', 'name');

    res.json(messages);
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
