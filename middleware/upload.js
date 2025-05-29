const multer = require('multer');

// Define storage for uploaded images
const storage = multer.memoryStorage();

// Set up multer middleware for handling multiple file uploads
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Allow only images
    if (
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/jpeg"
    ) {
      cb(null, true);
    } else {
      cb(new Error('Please upload only images'));
    }
  },
}).single('image'); // Ensure 'images' is the field name for uploading multiple files

// Middleware to handle multer errors
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      console.log("error from middleware")
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

module.exports = uploadMiddleware;
