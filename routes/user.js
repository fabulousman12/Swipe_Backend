const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const OtpVerification = require('../models/OtpVerification.js')
const fetchuser = require('../middleware/fetchuser');
require("dotenv").config();
const uploadMiddleware = require('../middleware/upload');
const JWT_SIGN = process.env.JWTSIGN;
const mysqlPromisePool = require('../Mydb.js');
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const mongoose = require('mongoose');
const vonage = require('@vonage/server-sdk');

const { sendOtp} = require('../VonageService.js')

// Route 1: Create a user using POST "user/createuser". Does not require auth
router.post('/createuser', uploadMiddleware,[
  body('email', 'Enter a valid email').isEmail(),
  body('username', 'Enter a valid username').isLength({ min: 3 }),
  body('password', 'Password must be longer than 6 characters').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);


  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, username, password,phoneNumber,otpCode,image } = req.body;
  console.log()
  console.log("email",email)
  console.log("username",username)
  console.log("username",password)
  console.log("username",phoneNumber)
  console.log("otp",otpCode)
var profilePhoto = null;
  let user = await User.findOne({ email });
if (image) {
  // Decode base64 image data URL
  const matches = image.match(/^data:(.+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    profilePhoto = {
      data: Buffer.from(matches[2], 'base64'),
      contentType: matches[1],
    };
  } else {
    profilePhoto = null; // or handle invalid format
  }
} else {
  profilePhoto = null;
}

  try {
    if (user) {
      console.log("user already exists")
      return res.status(400).json({ success:false,message: "User already exists" });
    }

    const otpRecord = await OtpVerification.findOne({ phoneNumber, otpCode });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // ✅ Delete OTP after successful validation
    await OtpVerification.deleteOne({ _id: otpRecord._id });

   
  
    const salt = await bcrypt.genSalt(10);
    const secPassword = await bcrypt.hash(password, salt);
 
console.log("profilePhoto",profilePhoto)
    user = new User({
      email,
      name:username,
      password: secPassword,
      phoneNumber,
      profilePhoto, // Save the image buffer if uploaded
      
    });

    await user.save();

    const payload = {
      user: {
        id: user.id
      }
    };

    const authtoken = jwt.sign(payload, JWT_SIGN);
    res.json({ success:true,authtoken });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route 2: Edit user details using PUT "/api/auth/edituser". Login required
router.put('/edituser', fetchuser, uploadMiddleware, async (req, res) => {
  const { email, name, About, gender, dob, location,profilePhoto } = req.body; // added gender, dob, location
  const profilepic = req.file;
  console.log("details",About,gender,dob,location);
var profile = null;
  try {


    let user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if(profilePhoto){
      // Decode base64 image data URL
      const matches = profilePhoto.match(/^data:(.+);base64,(.+)$/);
      if (matches && matches.length === 3) {
      
        user.profilePhoto = {

          data: Buffer.from(matches[2], 'base64'),
          contentType: matches[1],
        }
      } else {
        profile = null; // or handle invalid format
      }
    }  else{
profile = null;
    }
    if (email) {
      user.email = email;
    }

    // if (profilePhoto) {
    //   user.profilePhoto = {
    //     data: req.file.buffer,
    //     contentType: req.file.mimetype
    //   };
    // }

    // if (profilepic) {
    //   user.profilePhoto = {
    //     data: req.file.buffer,
    //     contentType: req.file.mimetype
    //   };
    // }

    if (name) {
      user.name = name;
    }

    if (About) {
      user.About = About;
    }

    // ✅ Add optional updates for new fields
    if (gender) {
      user.gender = gender;
    }

    if (dob) {
      user.dob = new Date(dob); // Ensure date conversion
    }

    if (location) {
      user.location = location;
    } 


    console.log("save profile",user)
    await user.save();

    res.json({ success: true, message: "User details updated successfully" });
  } catch (error) {
    console.error('Error editing user:', error);
    res.status(500).json({ error: "Something went wrong" });
  }
});


// Route 2: Authenticate user using POST "api/auth/login"
router.post('/login', [
  body('email', 'Enter a valid email').isEmail(),
  body('password', 'Password should not be blank').exists()
], async (req, res) => {
  // console.log("testing start")
  // console.time("myFunctionTime"); 
  // const start = performance.now();
  const errors = validationResult(req);
  let success = false;
 

  // If there are validation errors, return bad request and errors
  if (!errors.isEmpty()) {
    return res.status(400).json({ success, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    const temp = await User.find()
    
    if (!user) {
      console.log("invalid details and user doesnt exist")
      return res.status(400).json({ success, error: "Invalid credentials" });
    }

    const passCompare = await bcrypt.compare(password, user.password);
    if (!passCompare) {
      console.log("invalid details")
      return res.status(400).json({ success, error: "Invalid credentials" });
    }

    const payload = {
      user: {
        id: user.id
      }
    };

    const authtoken = jwt.sign(payload, JWT_SIGN);
    success = true;

    //Send response with token
    console.log("sent the auth")
    res.json({ success, authtoken });
    // console.timeEnd("myFunctionTime");
    // const end = performance.now();  // End timing
    // console.log(`Code block took ${(end - start).toFixed(2)} ms`);
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ success, error: "Internal Server Error", error });
  }
});

// Route 3: Get logged-in user details using POST "/api/auth/getuser". Login required
router.post('/getuser', fetchuser, async (req, res) => {
  try {
    // console.log("testing start")
    // console.time("myFunctionTime"); 
    // const start = performance.now();
    const userId = req.user.id;
    const user = await User.findById(userId).select("-password");
    if (!user) {
      const success = false
      return res.status(404).json({ success,error: "User not found" });
    }
    const profilePhotoData = user.profilePhoto?.data?.buffer;
const profilePhoto =

  profilePhotoData
    ? `data:${user.profilePhoto.contentType};base64,${Buffer.from(profilePhotoData).toString('base64')}`
    : null;
    const userResponse = {
      name: user.name,
  profilePhoto,
        phoneNumber:user.phoneNumber,
        email:user.email,
        _id : user._id,
        updatedAt: user.updatedAt,
        gender:user.gender,
        DOB:user.dob,
        Location:user.location,
        About:user.About
        

      // Add other user details you want to include in the response
    };

    const success = true
    
    res.json({success,userResponse});
    // console.timeEnd("myFunctionTime");
    // const end = performance.now();  // End timing
    // console.log(`Code block took ${(end - start).toFixed(2)} ms`);
    
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post('/alluser', fetchuser, async (req, res) => {
  try {
    const currentUserID = req.user.id;

    if (!mongoose.isValidObjectId(currentUserID)) {
      return res.status(400).json({ success: false, error: "Invalid User ID format" });
    }

    // Step 1: Parse provided timestamps from client
    const clientUserTimestamps = req.body.timestamps || []; // [{ id, updatedAt }]
    
    // Filter valid ObjectIDs and create a map: { id: updatedAt }
    const clientTimestampMap = new Map(
      clientUserTimestamps
        .filter(entry => mongoose.isValidObjectId(entry.id))
        .map(entry => [entry.id, new Date(entry.updatedAt)])
    );

    const validUserIds = [...clientTimestampMap.keys()];

    // Step 2: Fetch users from MongoDB
    const users = await User.find({ _id: { $in: validUserIds } });

    // Step 3: Compare timestamps
    const updatedUsers = users.filter(user => {
      const clientTime = clientTimestampMap.get(user._id.toString());
      return !clientTime || user.updatedAt > clientTime;
    });

    // Step 4: Format result
    const userDetails = updatedUsers.map(user => ({
      id: user._id,
      name: user.name,
      profilePic: user.profilePhoto
        ? `data:${user.profilePhoto.contentType};base64,${user.profilePhoto.data.toString('base64')}`
        : null,
      phoneNumber: user.phoneNumber,
      updatedAt: user.updatedAt,
      gender:user.gender,
      DOB:user.dob,
      Location:user.location
    }));

    res.json({ userDetails, currentUserId: currentUserID });
  } catch (error) {
    console.error('Error fetching updated users:', error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post('/existsuser', fetchuser,async (req, res) => {
  const phoneNumber = req.body.phoneNumber;
 

  try {
    // Search for a user by phoneNumber
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      console.log("user not found",phoneNumber)
      return res.status(303).json({status:false});
    }


    // Prepare user details to return
    const userDetails = {
      id: user._id,
      name: user.name,
profilePhoto:
  user.profilePhoto?.data
    ? `data:${user.profilePhoto.contentType};base64,${user.profilePhoto.data.toString('base64')}`
    : null,


      phoneNumber: user.phoneNumber,
      updatedAt: user.updatedAt,
      gender:user.gender,
      DOB:user.dob,
      Location:user.location
    };
    console.log("user found",userDetails)

    res.json({status:true,userDetails});
  } catch (error) {
    console.error('Error fetching user by phone number:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// Route to send OTP for phone number 
router.post('/sendotp', [
  body('phoneNumber', 'Enter a valid phone number').isLength({ min: 10 })
], async (req, res) => {
  const { phoneNumber } = req.body;
  const errors = validationResult(req);
console.log("phone",phoneNumber)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await OtpVerification.create({
      phoneNumber,
      otpCode
      // Ensure TTL is defined in schema
    });

  const result = await sendOtp(phoneNumber, otpCode);

console.log("result",result)
  if(result.status === 'FAILED' && result.message ==='SMS BALANCE UNAVAILABLE') {
 return res.status(500).json({ success: false, message: 'Failed to send OTP. Due to SMS balance issue. Please try again later.',otp: otpCode });
  }else if(result.status === 'FAILED') {
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again later.' });
  }

  

    res.status(200).json({ success: true, message: 'OTP sent successfully!' });
  } catch (error) {
    console.error('Error sending OTP:', error.message || error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again later.'
    });
  }
});


// Route 3: Get logged-in user details using POST "/api/auth/getuser". Login required
router.post('/updatetoken', fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { notification_Token, provider } = req.body;  // receive provider too

    console.log("token", notification_Token, "provider", provider);

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, error: "Invalid User ID format" });
    }

    // Build update object dynamically based on provider
    let updateObj = {};

    if (provider === 'onesignal' ) {
      updateObj.device_token_fcm = notification_Token;
    } else if (provider === 'pushy') {
      updateObj.device_token_pushy = notification_Token;
    } else {
      return res.status(400).json({ success: false, error: "Invalid provider" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateObj,
      { new: true, select: '_id device_token_fcm device_token_pushy' }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.json({ success: true, message: "Notification token updated successfully" });

  } catch (error) {
    console.error('Error updating notification token:', error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});



router.post('/fetchuser', fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;
    const requestUser = req.body.userid
    if (!mongoose.isValidObjectId(requestUser)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const user = await User.findById(requestUser).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const userResponse = {
      id: user._id,
      name: user.name,
      profilePic: user.profilePhoto ? `data:${user.profilePhoto.contentType};base64,${user.profilePhoto.data.toString('base64')}` : null,
      phoneNumber: user.phoneNumber,
      email: user.email,
      updatedAt: user.updatedAt,
      gender:user.gender,
      DOB:user.dob,
      Location:user.location
      
    };
    const success = true
    res.json({success,userResponse}); 
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: "Internal Server Error" });
  }
  })


module.exports = router;

