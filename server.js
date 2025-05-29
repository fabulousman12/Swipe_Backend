const express = require("express");
require("dotenv").config();
const https = require("https");
const mysql = require("mysql2");
const http = require("http");
const app = express();
const cors = require("cors");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const messageUpdateSchema = require("./models/messageUpdateSchema.js");
const connectDB = require("./db.js");
const User = require("./models/User.js");
const Message = require("./models/Message.js");
require("dotenv").config();
const path = require("path");
const uuid = require("uuid");
const fetchuser = require("./middleware/fetchuser");
const url = require("url");
const saveChunkToDatabase = require("./models/filesavetodb.js");
const WebSocket = require("ws");
const { v1: uuidv1 } = require("uuid");
const jwt = require("jsonwebtoken");
var fileRoutes = require("./routes/file");
const admin = require('firebase-admin');
const socketIo = require("socket.io");
const GroupMessage = require("./models/Groupmessage.js");
const JWT_SIGN = process.env.JWTSIGN;
const { Readable } = require("stream");
const mime = require('mime-types');
const Pushy = require('pushy');
const {oneSignalClient} = require('./onesignal.js');
const mysqlPromisePool = require("./Mydb.js"); // Adjust the path as per your project structure
// Middleware setup
const sslOptions = {
  key: fs.readFileSync("./server.key"), // Replace with your key path
  cert: fs.readFileSync("./server.cert"), // Replace with your certificate path
};
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT"],
  allowedHeaders: ["Content-Type", "Auth", "Authorization"], // Specify headers explicitly
  credentials: false, // IMPORTANT
};
app.use(cors(corsOptions));
const serviceAccount = require('./swipetest-f17e4-firebase-adminsdk-fbsvc-57603b275d.json');
app.options('*', cors(corsOptions)); // handle preflight
const pushyAPI = new Pushy(process.env.PUSHY_API_KEY);

// Initialize the AWS SDK and S3 client
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  GetObjectPresignedUrlCommand
} = require("@aws-sdk/client-s3");
const { Vonage } = require('@vonage/server-sdk')


// Initialize the S3 client
const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT, // Backblaze S3 endpoint
  region: "eu-central-003", // Choose the appropriate region
  credentials: {
    accessKeyId: process.env.B2_KEY_ID, // Your KeyID
    secretAccessKey: process.env.B2_APP_KEY, // Your ApplicationKey
  },
});

// Connect to Database
connectDB();
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
// Models
require("./models/User.js");
require("./models/Message.js");
require("./models/Group.js");
require("./models/Groupmessage.js");
// Error Handling
const errorHandler = require("./handler/errorHandler");
const { time } = require("console");
app.use(errorHandler.mongoseErrors);
app.get("/", (req, res) => {
  res.set("ngrok-skip-browser-warning", "true");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/index", (req, res) => {
  res.set("ngrok-skip-browser-warning", "true");
  res.sendFile(path.join(__dirname, "public", "index2.html"));
});

app.get("/api/download/:fileId", fetchuser, async (req, res) => {
  const { fileId } = req.params;

  try {
    // Query to fetch file data (file path, file size) from the database
    const [rows] = await mysqlPromisePool
      .promise()
      .query("SELECT * FROM messages WHERE fileId = ? LIMIT 1", [fileId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    const file = rows[0];

    const filePath = file.file_path; // File path stored in DB
    const fileName = file.fileName; // Original file name
    const fileSize = file.file_size; // Total size of the file

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Open a read stream for the file
    const fileStream = fs.createReadStream(filePath, { encoding: "binary" });

    // Set the appropriate headers for file download
    res.setHeader("Content-Type", file.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", fileSize);

    // Stream the file in chunks to the client
    fileStream.pipe(res);


    fileStream.on("end", () => {
      console.log("File download completed.");
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ message: "File download failed" });
  }
});
app.delete("/api/delete/:messageId", fetchuser, async (req, res) => {
  const { messageId } = req.params;

  // SQL query to update the message by removing the file data
  const deleteFileQuery = `
    UPDATE messages 
    SET file_path = NULL, file_name = NULL, file_type = NULL, 
        file_size = NULL, thumbnail = NULL, isDownload = 0, 
        totalChunks = 0, currentChunk = 0, isCompleted = false
        fileData = NULL
    WHERE id = ?
  `;

  try {
    // Run the SQL query
    const [result] = await mysqlPromisePool
      .promise()
      .query(deleteFileQuery, [messageId]);

    // If no rows are affected, it means the message was not found
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Message not found or file data already removed" });
    }

    // Successfully removed file data
    res.status(200).json({ message: "File data removed successfully" });
  } catch (error) {
    console.error("Error removing file data from message:", error);
    res.status(500).json({ message: "Error removing file data" });
  }
});
app.use("/user", require("./routes/user"));
app.use("/messages", require("./routes/message"));
app.use("/private", fileRoutes);
app.use("/groups", require("./routes/group"));
app.use("/api", require("./routes/patchUpdate.js"));
app.use(errorHandler.notFound);
if (process.env.ENV === "DEVELOPMENT") {
  app.use(errorHandler.developmentErrors);
} else {
  app.use(errorHandler.productionErrors);
}
// Start the server
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
// WebSocket server setup
const wss = new WebSocket.Server({ server });
function broadcastOnlineUsers() {
  const onlineUsers = [...wss.clients]
    .filter((client) => client.readyState === WebSocket.OPEN)
    .map((client) => ({ userId: client.userId, username: client.username }));

  const message = JSON.stringify({ type: "onlineUsers", users: onlineUsers });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}



/*

async function sendInitialMessages(ws, wss,connectionsMap) {
  try {
    const userId = ws.userId;
    console.log(userId);
    // Fetch distinct users (either sender or recipient) who have interacted with the current user from MySQL
    const query = 
      SELECT DISTINCT sender AS userId
      FROM messages
      WHERE recipient = ?
      UNION
      SELECT DISTINCT recipient AS userId
      FROM messages
      WHERE sender = ?
    ;
    const [distinctUsers, fields] = await mysqlPromisePool
      .promise()
      .query(query, [userId, userId]);
    // Prepare an array to collect all messages from MySQL
    const allMessagesFromMySQL = [];
    const messageIdsBySender = [];

    const findOrCreatePair = (pairs, sender, recipient) => {
      let pair = pairs.find(
        (p) => p.sender === sender && p.recipient === recipient
      );
      if (!pair) {
        pair = { sender, recipient, messageIds: [] }; // Create new pair
        pairs.push(pair);
      }
      return pair;
    };

    // Iterate through each distinct user pair and fetch up to 30 messages for each pair from MySQL
    for (const otherUser of distinctUsers) {
      const otherUserId = otherUser.userId;
      const messagesQuery = 
        SELECT *
        FROM messages
        WHERE ( (sender = ? AND recipient = ?)
          OR (sender = ? AND recipient = ?) 
    )AND status != 'sent'
        ORDER BY timestamp DESC 
       
      ;
      const [messages, msgFields] = await mysqlPromisePool
        .promise()
        .query(messagesQuery, [userId, otherUserId, otherUserId, userId]);
//AND status != 'sent' add this after testing
      // Push fetched messages to the array
      for (let message of messages) {
        if (message.sender === otherUserId) {
          // Initialize the array if it doesn't exist
          if (!messageIdsBySender[message.sender]) {
            messageIdsBySender[message.sender] = [];
          }
          messageIdsBySender[message.sender].push(message.id);
        }
        

        const messageIds = messages.map((message) => message.id);
        // Update the status of the current message to 'sent'
        const updateQuery = 
          UPDATE messages
          SET status = 'sent'
          WHERE id = ?;
        ;
        await mysqlPromisePool.promise().query(updateQuery, [message.id]);
        message.status = "sent";

        if (message.sender === otherUserId) {
          const pair = findOrCreatePair(
            messageIdsBySender,
            message.sender,
            message.recipient
          );
          pair.messageIds.push(message.id);
        }

        // After updating the status, push the updated message to the array
        allMessagesFromMySQL.push(message);
        console.log("allMessagesFromMySQL", allMessagesFromMySQL);
      }
    }

    for (const pair of messageIdsBySender) {
      const { sender, recipient, messageIds } = pair;
      const recipientSocket = [...wss.clients].find(
        (client) => client.userId === sender
      );
      if (recipientSocket) {
        console.log("Recipient socket found:", );
        // Sender is online; send message IDs
        const onlineMessage = JSON.stringify({
          type: "update",
          updateType: "status",
          messageIds,
          recipient,
        });
        recipientSocket.send(onlineMessage);
      } else {
        // Sender is offline; save updates to the database
        const update = new messageUpdateSchema({
          messageIds,
          type: "status",
          recipient,
          sender,
        });
        await update.save();
      }
    }
    console.log("sent initial messages",allMessagesFromMySQL)

    // Prepare the final message to send
    const message = JSON.stringify({
      type: "initialMessages",
      messages: allMessagesFromMySQL, // Send MySQL messages to the client
    });
    // Send the message to the client
    if (ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        type: "initialMessages",
        messages: allMessagesFromMySQL, // Send MySQL messages to the client
      });
      ws.send(message);
    } else {
      console.log('WebSocket is not open, retrying...');
      setImmediate(() => {
        sendInitialMessages(ws, wss, connectionsMap); // Retry without blocking the event loop
      });
    }
  } catch (error) {
    console.error("Error sending initial messages:", error);
  }
}


*/

// Function to send initial messages to a client upon connection
async function sendInitialMessages(ws, wss, connectionsMap, retryCount = 0) {
  try {
    const userId = ws.userId;
    if (!userId) return;

    console.log(`🔄 Sending initial messages for user: ${userId}`);

    // 1. Fetch all distinct users this user has talked to
    const userQuery = `
      SELECT DISTINCT sender AS userId FROM messages WHERE recipient = ?
      UNION
      SELECT DISTINCT recipient AS userId FROM messages WHERE sender = ?
    `;
    const [distinctUsers] = await mysqlPromisePool
      .promise()
      .query(userQuery, [userId, userId]);

    const allMessagesFromMySQL = [];
    const messageStatusUpdates = [];

    // 2. For each user pair, fetch messages not marked as 'sent'
    for (const otherUser of distinctUsers) {
      const otherUserId = otherUser.userId;
      const messagesQuery = `
        SELECT * FROM messages
        WHERE ((sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?))
        AND status != 'sent'
        ORDER BY timestamp DESC
      `;
      const [messages] = await mysqlPromisePool
        .promise()
        .query(messagesQuery, [userId, otherUserId, otherUserId, userId]);

      for (const message of messages) {
        // Update status to 'sent'
        await mysqlPromisePool
          .promise()
          .query(`UPDATE messages SET status = 'sent' WHERE id = ?`, [message.id]);

        message.status = 'sent'; // Update in-memory object too
        allMessagesFromMySQL.push(message);

        // Notify original sender if message is FROM someone else
        if (message.sender === otherUserId) {
          messageStatusUpdates.push({
            sender: message.sender,
            recipient: message.recipient,
            id: message.id
          });
        }
      }
    }

    // 3. Notify senders about message status (online/offline)
    const groupedBySender = {};
    for (const update of messageStatusUpdates) {
      if (!groupedBySender[update.sender]) {
        groupedBySender[update.sender] = {
          recipient: update.recipient,
          messageIds: []
        };
      }
      groupedBySender[update.sender].messageIds.push(update.id);
    }

    for (const [senderId, data] of Object.entries(groupedBySender)) {
      const socket = [...wss.clients].find((client) => client.userId === senderId);
      if (socket) {
        // Online: notify directly
        const notifyMsg = JSON.stringify({
          type: 'update',
          updateType: 'status',
          recipient: data.recipient,
          messageIds: data.messageIds,
        });
        socket.send(notifyMsg);
      } else {
        // Offline: save update for later
        const updateDoc = new messageUpdateSchema({
          type: 'status',
          sender: senderId,
          recipient: data.recipient,
          messageIds: data.messageIds,
        });
        await updateDoc.save();
      }
    }

    // 4. Send all collected messages to current user
    const outgoingMsg = JSON.stringify({
      type: "initialMessages",
      messages: allMessagesFromMySQL,
    });

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(outgoingMsg, (err) => {
        if (err) console.error("❌ Failed to send initial messages:", err);
        else console.log(`✅ Initial messages sent to user ${userId}`);
      });
    } else {
      if (retryCount < 5) {
        console.log(`⚠️ WS not open for ${userId}, retrying (${retryCount + 1}/5)...`);
        setTimeout(() => {
          sendInitialMessages(ws, wss, connectionsMap, retryCount + 1);
        }, 1000);
      } else {
        console.warn(`❌ Giving up on sending initial messages to ${userId}`);
      }
    }

  } catch (error) {
    console.error("💥 Error in sendInitialMessages:", error);
  }
}


async function processUpdatedMessages(ws,wss) {
  try {
    const userId = ws.userId; // The current user (recipient)

    // Step 1: Find the update records for this user (recipient) in MongoDB
    const updates = await messageUpdateSchema.find({ sender: userId });

    if (!updates || updates.length === 0) {
      console.log("No updates found for this user.");
      return;
    }

    // Prepare arrays to collect message IDs for different types
    let statusMessageIds = [];
    let unreadMessageIds = [];

    // Step 2: Separate the message IDs based on their type
    updates.forEach((update) => {
      if (update.type === "status") {
        statusMessageIds = [...statusMessageIds, ...update.messageIds];
      } else if (update.type === "unread") {
        unreadMessageIds = [...unreadMessageIds, ...update.messageIds];
      }
    });

    // Step 3: Find these messages in MySQL and update their status to 'sent' (if applicable)

    // Update the status of 'status' type messages to 'sent'

    // Step 4: Send the updated message IDs to the client by type
    if (statusMessageIds.length > 0) {
      const statusResponse = JSON.stringify({
        type: "update",
        updateType: "status", // The type for status updates
        messageIds: statusMessageIds, // Send the message IDs for status updates
      });
      ws.send(statusResponse); // Send the status update to the client
    }

    if (unreadMessageIds.length > 0) {
      const unreadResponse = JSON.stringify({
        type: "update",
        updateType: "unread", // The type for unread updates
        messageIds: unreadMessageIds, // Send the message IDs for unread updates
      });
      ws.send(unreadResponse); // Send the unread update to the client
    }

    // Step 5: Delete the MongoDB records after processing
    updates.forEach(async (update) => {
      await messageUpdateSchema.deleteOne({ _id: update._id });
    });
  } catch (error) {
    console.error("Error processing updated messages:", error);
  }
}
const connectionsMap = new Map(); 
////On sending messages
wss.on("connection", async (ws, req) => {
  const query = url.parse(req.url, true).query;
  const token = query.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SIGN);
      const userId = decoded.user.id;
      const user = await User.findById(userId).select("-password");
      if (user) {
        ws.userId = user.id;
        ws.username = user.name;
        connectionsMap.set(userId, ws); 
        console.log("Current connected users: ", [...connectionsMap.keys()]);
        sendInitialMessages(ws, wss,connectionsMap); // Send initial messages upon connection
        processUpdatedMessages(ws,wss);
        ws.on("close", () => {
          console.log(`User disconnected: ${ws.userId}`);
          connectionsMap.delete(ws.userId);  // ✅ Remove the user's connection
        });
        


      } else {
        ws.close();
      }
    } catch (error) {
      ws.close();
    }
  } else {
    ws.close();
  }

  ws.on("message", async (message) => {
    const messageData = JSON.parse(message.toString());
    const decoded = jwt.verify(token, JWT_SIGN);
    const userId = decoded.user.id;
    const user = await User.findById(userId).select("-password");
  
    const { recipient, content, messageId } = messageData;
    const sender = user.id;
    var stat = "pending";
    if (messageData.type === "messages") {
 
   
      if (recipient) {

        const newMessage = new Message({
          sender: sender,
          recipient,
          content,
          timestamp: new Date(),
          status: "pending",
          read: false,
        });
        //  await saveMessageToMySQL(sender, recipient, content,messageId);
        const recipientWs = connectionsMap.get(recipient);
   
          if (
            recipientWs && recipientWs.readyState === WebSocket.OPEN
          ) {
            recipientWs.send(
              JSON.stringify({
                type: "message",
                sender: sender,
                content,
                recipient,
       
                status: "sent",
                read: false,
                id: messageId,
                timestamp: new Date(),
              })
            )
            stat = "sent";
           
                 
      } else {
  async function getUserTokens(id) {
    const userHI = await User.findById(id).select('device_token_fcm device_token_pushy');
    return {
      fcmToken: userHI?.device_token_fcm || null,
      pushyToken: userHI?.device_token_pushy || null,
    };
  }

  const { fcmToken, pushyToken } = await getUserTokens(recipient);

  if (fcmToken) {
    // Prepare message for Firebase Cloud Messaging (FCM)
    const notificationPayload = {
    app_id: process.env.ONESIGNAL_APP_ID,
    include_player_ids: [fcmToken], // fcmToken here is OneSignal Player ID
    contents: { en: content },
    data: {
      recipient,
      sender,
      type: "message",
      timestamp: new Date().toISOString(),
      id: messageId,
      read: false,
      status: "sent",
    }
  };


    // Send notification via Firebase Admin SDK
      oneSignalClient.post('/notifications', notificationPayload)
    .then(response => {
      console.log('OneSignal notification sent successfully:', response.data);
      stat = "sent";
    })
    .catch(error => {
      console.error('Error sending OneSignal notification:', error.response?.data || error.message);
    });

  } else if (pushyToken) {
    // Prepare message for Pushy
    const data = {
      recipient,
      sender,
      content,
      type: "message",
      timestamp: new Date().toISOString(),
      id: messageId,
      read: false,
      status: "sent",
    };

    // Assuming you have Pushy SDK initialized as `Pushy`
    pushyAPI.sendPushNotification(data, pushyToken)
      .then(() => {
        console.log('Pushy notification sent successfully');
        stat = "sent";
      })
      .catch(error => {
        console.error('Error sending Pushy notification:', error);
      });

  } else {
    console.log('No valid device token found for recipient, no notification sent.');
    stat = "pending";
  }
}

       
        
console.log("status",stat)
if (stat === "sent") {
  console.log("Message sent to recipient:", recipient);
  
  // Prepare the message update to send via WebSocket
  const messageUpdatePayload = {
    type: "update",
    updateType: "status",
    messageIds: [messageId],
    sender,
  };

  try {
    // Attempt to send the update via WebSocket
    ws.send(JSON.stringify(messageUpdatePayload));

    console.log("Update sent via WebSocket:", messageUpdatePayload);
  } catch (error) {
    // If WebSocket send fails, log the error and save in database
    console.error("WebSocket send failed, saving to MessageUpdateSchema:", error);

    const updateNotification = new messageUpdateSchema({
      sender: sender,
      recipient: recipient,
      type: "unread",  // You can adjust the type as needed
      messageIds: [messageId],  // Assuming messageIds is an array
      timestamp: new Date(),
    });

    try {
      // Save the update in the database
      await updateNotification.save();
      console.log("Message update saved to MessageUpdateSchema.");
    } catch (dbError) {
      console.error("Failed to save message update to database:", dbError);
    }
  }
}


        await newMessage.save();

        await saveMessageToMySQL(
          sender,
          messageData.recipient,
          messageData.content,
          messageData.messageId,
          stat
        );
      }
    } else if (messageData.updatePayload && messageData.updatePayload.type === "update") {
      console.log("Update request received", messageData.updatePayload);

      const { messageIds, updateType, fileType,sender,recipient } = messageData.updatePayload;

      if (fileType === "ochi nichi") {
        // Update download status for all file chunks using only messageIds
        try {
      
          console.log(`${messageIds.length} files marked as downloaded successfully`);
      
          // Optionally, notify the sender about the update (if needed)
          const senderWs = connectionsMap.get(sender);
      
          if (senderWs && senderWs.readyState === WebSocket.OPEN) {
            senderWs.send(
              JSON.stringify({
                type: "update",
                updateType: "downloadStatus",
                messageIds,
                sender,
              })
            );
          } else {
            if (user.notification_Token) {
              const message = {
                token: user.notification_Token,
                data: {
                  type: "downloadStatus",
                  messageIds: JSON.stringify(messageIds),
                  sender,
                },
              };
      
              // Send notification via Firebase Admin SDK
              const response = await admin.messaging().send(message);
      
              if (response) {
                console.log("Download status notification sent.");
              } else {
                console.error("Error sending notification:", response.error);
              }
            }
          }
        } catch (err) {
          console.error("Error updating download status:", err.message);
        }
      }
      else if(messageData.updatePayload.updateType === "unread"){
console.log("got here ")
try {
  // 1. Update the `read` status of messages in MySQL
  const updateQuery = `
    UPDATE messages
    SET \`read\` = 1
    WHERE id IN (?)
  `;
  
  const [updateResult] = await mysqlPromisePool.promise().query(updateQuery, [messageIds]);
  if (updateResult.affectedRows === 0) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "No messages found for the provided IDs",
      })
    );
    return;
  }

  console.log("Messages updated in MySQL");

  // 2. Fetch the messages to get recipient and sender information


  // Extract recipient and sender info (assuming all messages belong to the same sender/recipient)


  console.log(`Updating messages for recipient: ${recipient}, sender: ${sender}`);

  // 3. Notify the recipient if they are online
  let sendernotification = false;
const recipientWs = connectionsMap.get(sender);
  
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      recipientWs.send(
        JSON.stringify({
          type: "update",
          updateType: "unread",
          messageIds,
          sender,
          recipient,
        })
      );
      sendernotification = true;
      console.log("Message sent to sender");
    }


  // 4. If the recipient is not online, try sending a push notification using Firebase


  // 5. If the recipient is still not notified, save the update in MongoDB
  if (!sendernotification) {
    const updateNotification = new messageUpdateSchema({
      sender: sender,
      recipient: recipient,
      type: "unread",
      messageIds,
      timestamp: new Date(),
    });

    await updateNotification.save();
    console.log("Update saved in MongoDB");
  }

  // 6. Send a response back to the WebSocket client confirming the update
  ws.send(
    JSON.stringify({
      type: "success",
      message: "Messages marked as unread and recipient notified (or update saved)",
    })
  );
} catch (error) {
  console.error("Error processing unread update:", error);
  ws.send(
    JSON.stringify({
      type: "error",
      message: "Failed to process unread update request",
    })
  );
}
    }
    } ////
    if (messageData.type === "file") {
      const {
        sender,
        recipient,
        thumbnail,
        file_name,
        file_type,
        id,
        file_size,
        type,
        file_path,
      } = messageData;
    
     
     
      let status = "pending";
      
      // 1. Generate thumbnail if image or video
   
    
      // 2. Upload file to S3 or Backblaze (Assuming uploadFile returns URL)
   
    
      // 3. Prepare message object for DB
      const messageForDB = {
        id,
        sender,
        recipient,
        content: null,
        timestamp: new Date().toISOString(),
        status, // will be updated if sent
        read: 0,
        isDeleted: 0,
        isDownload: 0,
        type: "file",
        file_name,
        file_type,
        file_size,
        thumbnail, // BLOB (can be Buffer or base64 depending on DB)
        file_path,
      };
    
      // 4. Check if recipient is online
      const recipientWs = connectionsMap.get(recipient);
      if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
        status = "sent";
       console.log("sent to recipient")
        recipientWs.send(
          JSON.stringify({
            type: "file",
            id,
            sender,
            recipient,
            type,
            file_name,
            file_type,
            file_size,
            thumbnail,
            timestamp: messageForDB.timestamp,
            file_path,
            status,
          })
        );
      } else {
        // 5. If offline, send FCM notification
        async function getUserTokens(id) {
    const userHI = await User.findById(id).select('device_token_fcm device_token_pushy');
    return {
      fcmToken: userHI?.device_token_fcm || null,
      pushyToken: userHI?.device_token_pushy || null,
    };
  }

    const { fcmToken, pushyToken } = await getUserTokens(recipient);

      
            
          
           
             
       if(fcmToken){

            const notificationPayload = {
    app_id: process.env.ONESIGNAL_APP_ID,
    include_player_ids: [fcmToken], // fcmToken here is OneSignal Player ID
    contents: { en: content },
   data: {
            type: "file",
            id,
            sender,
            recipient,
            file_name,
            file_type,
            file_size: file_size.toString(),
            thumbnail: thumbnail,
            timestamp: messageForDB.timestamp,
            file_path,
            status,
            userProfilePic : profilePhoto,
            username,
          },
  };

   
           oneSignalClient.post('/notifications', notificationPayload)
    .then(response => {
      console.log('OneSignal notification sent successfully:', response.data);
      status = "sent";
    })
    .catch(error => {
      console.error('Error sending OneSignal notification:', error.response?.data || error.message);
    });
      }else if (pushyToken) {
  data= {
            type: "file",
            id,
            sender,
            recipient,
            file_name,
            file_type,
            file_size: file_size.toString(),
            thumbnail: thumbnail,
            timestamp: messageForDB.timestamp,
            file_path,
            status,
            userProfilePic : profilePhoto,
            username,
          }

              pushyAPI.sendPushNotification(data, pushyToken)
      .then(() => {
        console.log('Pushy notification sent successfully');
        status = "sent";
      })
      .catch(error => {
        console.error('Error sending Pushy notification:', error);
      });




      }else{
        console.log('No valid device token found for recipient, no notification sent.');
        status = "pending";
      }
      }
    
      // 6. Save file metadata in database

    
      // 7. Inform sender that status is updated
      if (status === "sent") {
        console.log("Message sent to recipient:", recipient);
        
        // Prepare the message update to send via WebSocket
        const messageUpdatePayload = {
          type: "update",
          updateType: "status",
          messageIds: [id],
          sender,
        };
      
        try {
          // Attempt to send the update via WebSocket
          ws.send(JSON.stringify(messageUpdatePayload));
      
          console.log("Update sent via WebSocket:", messageUpdatePayload);
        } catch (error) {
          // If WebSocket send fails, log the error and save in database
          console.error("WebSocket send failed, saving to MessageUpdateSchema:", error);
      
          const updateNotification = new messageUpdateSchema({
            sender: sender,
            recipient: recipient,
            type: "unread",  // You can adjust the type as needed
            messageIds: [id],  // Assuming messageIds is an array
            timestamp: new Date(),
          });
      
          try {
            // Save the update in the database
            await updateNotification.save();
            console.log("Message update saved to MessageUpdateSchema.");
          } catch (dbError) {
            console.error("Failed to save message update to database:", dbError);
          }
        }
      }
      messageForDB.status = status;
    
      try {
        await saveFileToDatabase(  messageForDB.sender,
          messageForDB.recipient,
          messageForDB.thumbnail,
          messageForDB.status,
          messageForDB.id,
          messageForDB.file_name,
          messageForDB.file_type,
          messageForDB.file_path); // Pass single object
      } catch (dbErr) {
        console.error("Error saving file metadata to DB:", dbErr);

      }
    }
    
  });
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    if (ws.readyState === WebSocket.OPEN) {
      connectionsMap.delete(ws.userId); // Remove the user from the connections map
      ws.close();
    }
  });
});
const sendMessageToUser = (userId, message) => {
  const ws = connectionsMap.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  }
};

const sendNotification = async (recipientId, senderId, content, messageId) => {
  const recipient = await User.findById(recipientId);
  if (recipient && recipient.notification_Token) {
    const userProfilePic = recipient.profilePhoto || 'default.jpg'; // Get profile photo (use default if not available)
    const message = {
      notification: {
        title: recipient.name || 'Default Title',
        body: content || 'Default body text',
      },
      token: recipient.notification_Token,
      data: {
        recipient: recipientId,
        sender: senderId,
        userProfilePic,
        content,
        type: 'message',
        timestamp: new Date(),
        id: messageId,
        status: 'sent',
      },
    };
    try {
      await admin.messaging().send(message);
      console.log('Notification sent successfully');
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }
};

// Function to handle errors and clean up

/**
 * Function to delete a saved chunk from MongoDB if needed
 */
/**
 * Function to save chunk to MongoDB
 */

/**
 * Handle file transfer error by deleting incomplete file chunks and notifying sender/recipient
 */

// Function to upload file to S3
async function uploadToS3(fileBuffer, fileName, mimeType,folder) {
  const uniqueFileName = `${uuidv1()}-${fileName}`;
  const key = `${folder}/${uniqueFileName}.${mimeType.split("/")[1]}`;
  const params = {
    Bucket: process.env.B2_Bucket, // Replace with your S3 bucket name
    Key: `${fileName}/${uuidv1()}.png`, // Path for thumbnail in the bucket
    Body: fileBuffer, // The file content (buffer)
    ContentType: fileType, // The MIME type of the file
ACL:"private"
  };

  try {
    const data = await s3.send(new PutObjectCommand(params));
    const getObjectParams = {
      Bucket: process.env.B2_Bucket,
      Key: key,
    };

    const command = new GetObjectPresignedUrlCommand(getObjectParams);
    const presignedUrl = await s3.getSignedUrl(command, { expiresIn: 604800 });
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    console.log("File uploaded successfully. File URL:", presignedUrl);

    return presignedUrl;
  } catch (error) {
    console.error("Error uploading thumbnail:", error);
    throw new Error("Thumbnail upload failed");
  }
}

// Function to generate image thumbnail
async function generateImageThumbnail(filePath) {
  try {
    const imageBuffer = await sharp(filePath)
      .resize(150, 150) // Resize to 150x150, you can adjust this as needed
      .toBuffer(); // Get image buffer

    // Upload the thumbnail to S3
    const thumbnailUrl = await uploadToS3(
      imageBuffer,
      "image-thumbnail.png",
      "image/png"
    );
    return thumbnailUrl; // Return the URL of the uploaded thumbnail
  } catch (error) {
    console.error("Error generating image thumbnail:", error);
    throw new Error("Could not generate image thumbnail");
  }
}

// Function to generate video thumbnail
async function generateVideoThumbnail(filePath) {
  try {
    const thumbnailPath = path.join(__dirname, `${uuidv1()}.png`);

    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .screenshots({
          count: 1, // Generate 1 screenshot
          folder: path.dirname(thumbnailPath),
          filename: path.basename(thumbnailPath),
          size: "150x150", // Resize the thumbnail to 150x150
        })
        .on("end", resolve)
        .on("error", reject);
    });

    // Read the file into a buffer
    const fs = require("fs");
    const thumbnailBuffer = fs.readFileSync(thumbnailPath);

    // Upload the thumbnail to S3
    const thumbnailUrl = await uploadToS3(
      thumbnailBuffer,
      "video-thumbnail.png",
      "image/png"
    );
    return thumbnailUrl; // Return the URL of the uploaded thumbnail
  } catch (error) {
    console.error("Error generating video thumbnail:", error);
    throw new Error("Could not generate video thumbnail");
  }
}

// Main function to generate a thumbnail based on the file type
async function generateThumbnail(filePath, fileType) {
  try {
    let thumbnailUrl;

    if (fileType.startsWith("image")) {
      // Handle image files
      thumbnailUrl = await generateImageThumbnail(filePath);
    } else if (fileType.startsWith("video")) {
      // Handle video files
      thumbnailUrl = await generateVideoThumbnail(filePath);
    } else {
      throw new Error("Unsupported file type for thumbnail generation");
    }

    return thumbnailUrl; // Return the URL of the generated thumbnail
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    throw error;
  }
}

async function saveMessageToMySQL(sender, recipient, content, messageId, status) {
  const insertQuery = `
    INSERT IGNORE INTO messages (id, sender, recipient, content, timestamp, status, \`read\`)
    VALUES (?, ?, ?, ?, NOW(), ?, 0)
  `;

  try {
    const [insertResult] = await mysqlPromisePool
      .promise()
      .query(insertQuery, [messageId, sender, recipient, content, status]);

    return insertResult.insertId;
  } catch (error) {
    console.error("Error inserting message:", error);
    throw error;
  }
}
async function saveFileToDatabase(
  sender,
  recipient,
  thumbnail,
  status,
  id,
  file_name,
  file_type,
  file_path
) {
  const content = null;
  const fileData = null;
  const chunkNumber = 0;
  const totalChunks = 0;
  const fileName = file_name;
  const fileId = id;
  const fileType = file_type;

  const insertQuery = `
    INSERT INTO messages (
      id,
      sender,
      recipient,
      content,
      timestamp,
      status,
      \`read\`,
      fileId,
      fileData,
      fileName,
      fileType,
      thumbnail,
      totalChunks,
      currentChunk,
      isCompleted,
      file_path,
      type
    )
    VALUES (?, ?, ?, ?, NOW(), ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
  `;

  try {
    // ✅ Check if ID already exists
    const [existing] = await mysqlPromisePool
      .promise()
      .query(`SELECT id FROM messages WHERE id = ?`, [id]);

    if (existing.length > 0) {

      console.log("Message ID already exists, skipping insert.",id);
      return null;
    }

    const [insertResult] = await mysqlPromisePool.promise().query(insertQuery, [
      id, sender, recipient, content, status, fileId, fileData, fileName,
      fileType, thumbnail, totalChunks, chunkNumber,
      chunkNumber === totalChunks ? 1 : 0, file_path, "file"
    ]);

    return insertResult.insertId;
  } catch (error) {
    console.error("Error saving file to MySQL:", error);
    throw error;
  }
}

async function updateMessagesByIds(messageIds, updateType, sender, recipient, ws) {
  const updateQuery = `
    UPDATE messages
    SET \`read\` = 1
    WHERE id IN (?)
  `;

  try {
    // Execute the update query in MySQL
    await executeMySQLQuery(updateQuery, [messageIds]);
    console.log("Messages updated in MySQL");

    // Check if the recipient is online and send updates
    let recipientNotified = false;

    // Loop through WebSocket clients to notify the sender if online
    wss.clients.forEach((client) => {
      if (client.userId === sender && client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "update",
            updateType,
            messageIds,
            sender,
            recipient,
          })
        );
        recipientNotified = true;
      } else if (client.userId === recipient && client.readyState === WebSocket.OPEN) {
        // Notify the recipient if they're online
        client.send(
          JSON.stringify({
            type: "update",
            updateType,
            messageIds,
            sender,
            recipient,
          })
        );
        recipientNotified = true;
      }
    });

    // If recipient is not online, send a Firebase notification
    if (!recipientNotified && recipient.notification_Token) {
      const message = {
        token: recipient.notification_Token,
        data: {
          type: "update",
          updateType,
          messageIds,
          sender,
          recipient,
        },
      };

      try {
        const response = await admin.messaging().send(message);
        if (response) {
          console.log("Notification sent via Firebase");
        } else {
          console.error("Error sending Firebase notification");
        }
      } catch (error) {
        console.error("Error sending notification via Firebase", error);
      }
    }

    // If recipient is not online, save the update in MongoDB
    if (!recipientNotified) {
      const updateNotification = new messageUpdateSchema({
        sender: sender,
        recipient: recipient,
        type: "unread",
        messageIds,
        timestamp: new Date(),
      });
      await updateNotification.save();
      console.log("Update saved in MongoDB");
    }

    // Return success if everything went well
    return { success: true };
  } catch (err) {
    console.error("Error updating messages:", err);
    // Return error details if something went wrong
    return { success: false, error: err.message };
  }
}



module.exports = app;
