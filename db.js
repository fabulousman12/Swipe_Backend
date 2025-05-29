const mongoose = require('mongoose');
require("dotenv").config();
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE3);
    console.log('Connected to MongoDB on port ', process.env.PORT);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit process with failure
  }
  mongoose.connection.on("error",(err)=>{
    console.log("Mongose failes" + err.message)
  })
};

module.exports = connectDB;

