const express = require('express');
const router = express.Router();
const processUnembeddedMessages = require('../utils/processUnembeddedMessages');
const authMiddleware = require('../middleware/authMiddleware');

// Admin route to process unembedded messages
router.post('/process-embeddings', authMiddleware.authenticateToken, authMiddleware.isAdmin, async (req, res) => {
  try {
    console.log('Admin request to process unembedded messages');
    
    // Start the processing
    const result = await processUnembeddedMessages();
    
    res.json({
      success: true,
      message: 'Processing of unembedded messages completed',
      data: result
    });
  } catch (error) {
    console.error('Error in process-embeddings route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process unembedded messages',
      error: error.message
    });
  }
});

module.exports = router;