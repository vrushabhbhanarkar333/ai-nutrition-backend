const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/register', authMiddleware.validateRegisterInput, userController.register);
router.post('/login', userController.login);
router.post('/logout', userController.logout);

// Protected routes
router.get('/profile', authMiddleware.authenticateToken, userController.getProfile);
router.put('/profile', authMiddleware.authenticateToken, userController.updateProfile);

module.exports = router; 