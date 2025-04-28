const express = require('express');
const router = express.Router();
const { profileController, upload } = require('../controllers/profileController');
const auth = require('../middleware/auth');

// Check if profile exists (requires authentication)
router.get('/exists', auth, profileController.checkProfileExists);

// Create profile (requires authentication)
router.post('/', auth, profileController.createProfile);

// Get profile (requires authentication)
router.get('/', auth, profileController.getProfile);

// Update profile (requires authentication)
router.put('/', auth, profileController.updateProfile);

// Upload profile picture (requires authentication)
router.post('/picture', auth, upload.single('profilePicture'), profileController.uploadProfilePicture);

module.exports = router; 