// routes/group.js
const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const GroupMessage = require('../models/Groupmessage');
const fetchuser = require('../middleware/fetchuser');
const User = require('../models/User');
const uploadMiddleware = require('../middleware/upload');

// Create a new group
router.post('/create', fetchuser, uploadMiddleware,async (req, res) => {
  try {
    const { name, phoneNumbers } = req.body;
    const userId = req.user.id;

    // Function to fetch user IDs based on phone numbers
    const members = await Promise.all(
      phoneNumbers.map(async phoneNumber => {
        const user = await User.findOne({ phoneNumber });
        return user ? user._id : null;
      })
    );

    // Remove null values (users not found)

    const profilePhoto = req.file ? {
        data: req.file.buffer,
        contentType: req.file.mimetype
      } : null;
    const validMembers = members.filter(member => member !== null);

    const group = new Group({
      name,
      members: [userId, ...validMembers],
      admins: [userId],
      profilePhoto :profilePhoto
    });

    await group.save();
    res.json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add a member to the group

router.post('/add-member', fetchuser, async (req, res) => {
  try {
    
    const { groupId, members } = req.body;
    console.log(groupId,members)
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.admins.includes(userId)) {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    // Find user ID by phone number
    const newMembers = [];

    for (const phoneNumber of members) {
      // Find user ID by phone number
      const user = await User.findOne({ phoneNumber });
      if (!user) {
        console.log(`User with phone number ${phoneNumber} not found`);
        continue; // Skip this iteration if user is not found
      }

      // Check if user is already in the group
      if (group.members.includes(user._id)) {
        console.log(`User with phone number ${phoneNumber} is already a member`);
        continue; // Skip if the user is already in the group
      }

      // Add user ID to newMembers array
      newMembers.push(user._id);
    }

    // Add new members to the group
    group.members.push(...newMembers);

    await group.save();
    res.status(200).json({success: "added successfully" });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Remove a member from the group
router.post('/remove-member', fetchuser, async (req, res) => {
  try {
    const { groupId, phoneNumber } = req.body;
    const userId = req.user.id;
    
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.admins.includes(userId)) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    // Find user ID by phone number
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    group.members = group.members.filter(member => member.toString() !== user._id.toString());
    await group.save();
    res.json(group);
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Fetch group message history

router.post('/history', fetchuser, async (req, res) => {
  try {

    const { groupId, limit = 30 } = req.body;

    const page = parseInt(req.body.page) || 1;
    

    const allGroupMessages = [];
   
    
      // Fetch messages for the specified group with pagination
      const groupMessages = await GroupMessage.find({ group: groupId })
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();

        

      // Fetch sender details for each message
      for (const message of groupMessages) {
        const sender = await User.findById(message.sender).select('name');
        allGroupMessages.push({
          ...message.toObject(),
          groupId: groupId,
          sender: sender ? sender.name : 'Unknown'
        });
      
    }


    res.json(allGroupMessages);
  } catch (error) {
    console.error('Error fetching group message history:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Fetch user's groups
router.get('/user-groups', fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;
    

    const groups = await Group.find({ members: userId }).select("-members");;
    const groupsWithBase64Photos = groups.map(group => {
      // Convert Mongoose document to plain JavaScript object
      const groupObject = group.toObject();
      let profilePhotoBase64 = null;

      if (groupObject.profilePhoto && groupObject.profilePhoto.data) {
        profilePhotoBase64 = `data:${groupObject.profilePhoto.contentType};base64,${groupObject.profilePhoto.data.toString('base64')}`;
      }

      return {
        ...groupObject,
        profilePhoto: profilePhotoBase64
      };
    });
       
    res.json(groupsWithBase64Photos);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/group-messages',fetchuser,async(req,res)=>{
try{

  const userId = req.user.id;
  
  
  const groups = await Group.find({members: userId});

  const allGroupMessages = [];
  
  for (const group of groups) {
    const groupMessages = await GroupMessage.find({ group: group._id })
      .sort({ timestamp: -1 })
      .limit(30)
      .exec();

  
      for (const message of groupMessages) {
        const sender = await User.findById(message.sender).select('name');
        allGroupMessages.push({
          ...message.toObject(),
          groupId: group._id,
          sender: sender ? sender.name : 'Unknown'
        });
      }
    }

  

  res.json(allGroupMessages);


}catch(error){
  console.error('Error fetching group messages:', error);
  res.status(500).json({ error: 'Internal Server Error' });

}
})

router.post('/group-members', fetchuser, async (req, res) => {
  try {
    
    const userId = req.user.id;
    const { groupId } = req.body;

    // Check if the current user is a member of the group
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(userId)) {
      return res.status(404).json({ error: 'Group not found or user is not a member' });
    }

    // Get the details of all group members
    const members = await User.find({ _id: { $in: group.members } }, 'name phoneNumber profilePhoto').select("-_id");
    const membersWithBase64Photos = members.map(member => {
      const memberObject = member.toObject();
      let profilePhotoBase64 = null;

      if (memberObject.profilePhoto && memberObject.profilePhoto.data) {
        profilePhotoBase64 = `data:${memberObject.profilePhoto.contentType};base64,${memberObject.profilePhoto.data.toString('base64')}`;
      }

      return {
        ...memberObject,
        profilePhoto: profilePhotoBase64
      };
    });
    // Return the member details
    res.json(membersWithBase64Photos);

  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



module.exports = router;
