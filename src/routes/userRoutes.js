const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// Public routes
router.post('/register', userController.register);
router.post('/register-with-profile', userController.registerWithProfile);
router.post('/login', userController.login);
router.post('/check-email', userController.checkEmailExists);
router.post('/logout', userController.logout);

// Protected routes
router.get('/profile', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.post('/notification-token', auth, userController.updateNotificationToken);

module.exports = router; 