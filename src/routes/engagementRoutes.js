const express = require('express');
const router = express.Router();
const engagementController = require('../controllers/engagementController');
const authMiddleware = require('../middleware/authMiddleware');

// User routes
router.get('/random', authMiddleware.authenticateToken, engagementController.getRandomMessage);
router.post('/respond', authMiddleware.authenticateToken, engagementController.respondToMessage);

// Admin routes
router.post('/admin/create', authMiddleware.authenticateToken, authMiddleware.isAdmin, engagementController.createMessage);
router.get('/admin/all', authMiddleware.authenticateToken, authMiddleware.isAdmin, engagementController.getAllMessages);
router.put('/admin/update/:id', authMiddleware.authenticateToken, authMiddleware.isAdmin, engagementController.updateMessage);
router.delete('/admin/delete/:id', authMiddleware.authenticateToken, authMiddleware.isAdmin, engagementController.deleteMessage);

module.exports = router;