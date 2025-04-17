const Profile = require('../models/Profile');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for profile picture upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/profiles';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image file.'), false);
    }
  }
});

const profileController = {
  // Create new profile
  createProfile: async (req, res) => {
    try {
      const { height, weight, fitnessGoals, activityLevel } = req.body;
      const userId = req.user._id; // Assuming user is authenticated

      // Check if profile already exists
      const existingProfile = await Profile.findOne({ userId });
      if (existingProfile) {
        return res.status(400).json({
          success: false,
          error: 'Profile already exists for this user'
        });
      }

      const profile = new Profile({
        userId,
        height,
        weight,
        fitnessGoals,
        activityLevel
      });

      await profile.save();

      res.status(201).json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error creating profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get profile
  getProfile: async (req, res) => {
    try {
      const userId = req.user._id;
      const profile = await Profile.findOne({ userId });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
      }

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Update profile
  updateProfile: async (req, res) => {
    try {
      const userId = req.user._id;
      const updates = req.body;

      const profile = await Profile.findOne({ userId });
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
      }

      // Update fields
      Object.keys(updates).forEach(key => {
        if (key !== 'userId' && key !== '_id') {
          profile[key] = updates[key];
        }
      });

      await profile.save();

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Upload profile picture
  uploadProfilePicture: async (req, res) => {
    try {
      const userId = req.user._id;
      const profile = await Profile.findOne({ userId });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image file provided'
        });
      }

      // Delete old profile picture if exists
      if (profile.profilePicture) {
        const oldPicturePath = path.join(__dirname, '..', profile.profilePicture);
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath);
        }
      }

      // Update profile with new picture path
      profile.profilePicture = req.file.path;
      await profile.save();

      res.json({
        success: true,
        data: {
          profilePicture: profile.profilePicture
        }
      });
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = { profileController, upload }; 