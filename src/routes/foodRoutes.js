const express = require('express');
const router = express.Router();
const multer = require('multer');
const foodController = require('../controllers/foodController');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image file.'), false);
    }
  }
});

// Food analysis route
router.post('/analyze', upload.single('image'), foodController.analyzeFood);

module.exports = router; 