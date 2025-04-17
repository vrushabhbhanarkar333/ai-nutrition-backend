const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

// Protected routes
router.post('/message', authMiddleware.authenticateToken, chatController.sendMessage);
router.get('/history', authMiddleware.authenticateToken, chatController.getChatHistory);

module.exports = router; 