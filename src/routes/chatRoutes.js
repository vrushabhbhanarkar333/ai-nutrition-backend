const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');

// Create uploads directory for chat images if it doesn't exist
const chatImagesDir = path.join(__dirname, '../../uploads/chat-images');
if (!fs.existsSync(chatImagesDir)) {
  fs.mkdirSync(chatImagesDir, { recursive: true });
}

// Protected routes
router.post('/message', authMiddleware.authenticateToken, chatController.sendMessage);
router.get('/history', authMiddleware.authenticateToken, chatController.getChatHistory);
router.delete('/conversation/:conversationId', authMiddleware.authenticateToken, chatController.deleteConversation);

module.exports = router;