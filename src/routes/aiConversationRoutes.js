const express = require('express');
const router = express.Router();
const aiConversationController = require('../controllers/aiConversationController');
const auth = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// General AI conversation
router.post('/chat', aiConversationController.conversationChat);

module.exports = router;