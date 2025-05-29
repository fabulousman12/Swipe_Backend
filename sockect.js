// app.js
const jwt = require('jsonwebtoken');
const express = require('express');
require("dotenv").config();

const User = require('./models/User.js');
const cors = require('cors');
const connectDB = require('./db.js');
const GroupMessage = require('./models/Groupmessage.js');
const socketIo = require('socket.io');
const fetchuser = require('./middleware/fetchuser.js')
const JWT_SIGN = "Jitcodeissuper"; // Make sure JWT_SIGN is set in your environment variables
const Group = require('./models/Group.js'); // Assuming you have a Group model defined

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

require('./models/User.js');
require('./models/Message.js');

require('./models/Groupmessage.js');


// Socket.IO setup
const httpServer = require('http').createServer(app);
const io = socketIo(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const onlineUsers = {};

// Socket.IO event handling
io.on('connection', (socket) => {

    const customData = socket.handshake.headers['x-custom-data'];



  if (!customData) {
    return res.status(401).json({ errors: "Access denied, no token provided" });
  }

  try {
    const decoded = jwt.verify(customData, JWT_SIGN);

    const userid = decoded.user;

    onlineUsers[userid.id] = socket.id;

    socket.on('disconnect', () => {
        
        const userId = Object.keys(onlineUsers).find(key => onlineUsers[key] === socket.id);
        if (userId) {
            console.log(`User ${userid.id} disconnected.`);
            delete onlineUsers[userid.id]; 
        }
    });

  }catch(err){

  }


    socket.on('sendMessage', async (data) => {
        try {

            // Create a new message and save it to MongoDB
                          // Extract message data
                          const { sender, content, group } = data;
                          if (!sender ||  !content || !group) {
                            throw new Error('Required fields missing in sendMessage data');
                        }
                        const sendername = await User.findById(sender)
                        console.log(sendername.name)
    
                          // Create a new message object
                          const newMessage = new GroupMessage({
                              sender,
                              content,
                              group,
                              timestamp: new Date(),
                              status: 'pending', // Pending until delivery
                              readBy: group
                          });
      
                          // Save the message to the database
                          await newMessage.save();
                        
                          const groupfind = await Group.findById(group);
                          if (!groupfind) {
                              throw new Error('Group not found');
                          }
                          const usersInGroup = await User.find({ _id: { $in: groupfind.members } });

                          // Emit the message to online users in the group
                          // Check if recipient is online and send the message
                       
                        
                 usersInGroup.forEach(user => {

                    const socketId = onlineUsers[user.id];
          
                    if (socketId && user.id !== sender) { // Exclude sender's own socket
                        io.to(socketId).emit('message', {
                            type: 'message',
                            sender: sendername.name,
                            content,
                            group,
                            status: 'sent',
                            readBy: user._id,
                            id: newMessage._id,
                            timestamp: newMessage.timestamp
                        });
                        console.log("message")
                    }
                });

                     
        } catch (error) {
            console.error('Error handling sendMessage:', error);
            socket.emit('errorMessage', { message: 'Failed to send message' });
        }
    });
});

// Start HTTP server

httpServer.listen(process.env.SERVER2, () => {
    console.log(`Server is running on port ${process.env.SERVER2}`);
});
