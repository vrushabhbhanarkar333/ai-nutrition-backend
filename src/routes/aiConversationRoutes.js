const express = require('express');
const router = express.Router();
const aiConversationController = require('../controllers/aiConversationController');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure directory exists
    if (!fs.existsSync('uploads/chat-images')) {
      fs.mkdirSync('uploads/chat-images', { recursive: true });
    }
    cb(null, 'uploads/chat-images');
  },
  filename: function (req, file, cb) {
    // Generate a unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
  }
});

// Apply authentication middleware to all routes
router.use(auth);

// General AI conversation with image upload support
router.post('/chat', upload.single('image'), aiConversationController.conversationChat);

module.exports = router;