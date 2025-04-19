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
      const { 
        height, 
        weight, 
        fitness_goal, 
        activity_level, 
        age, 
        gender, 
        dietary_restrictions 
      } = req.body;

      // Validate required fields
      if (!height || !weight || !fitness_goal || !activity_level) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: height, weight, fitness_goal, and activity_level are required'
        });
      }

      const userId = req.user._id; // Assuming user is authenticated

      // Check if profile already exists
      const existingProfile = await Profile.findOne({ userId });
      if (existingProfile) {
        return res.status(400).json({
          success: false,
          error: 'Profile already exists for this user'
        });
      }

      // Create new profile with all fields
      const profile = new Profile({
        userId,
        height,
        weight,
        fitness_goal,
        activity_level,
        age,
        gender,
        dietary_restrictions
      });

      await profile.save();

      // Get user info to include in response
      const user = req.user;

      res.status(201).json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name || user.username,
          height: profile.height,
          weight: profile.weight,
          fitness_goal: profile.fitness_goal,
          activity_level: profile.activity_level,
          age: profile.age,
          gender: profile.gender,
          dietary_restrictions: profile.dietary_restrictions,
          profile_picture: profile.profilePicture,
          created_at: profile.createdAt,
          updated_at: profile.updatedAt
        }
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

      // Get user info to include in response
      const user = req.user;

      res.json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name || user.username,
          height: profile.height,
          weight: profile.weight,
          fitness_goal: profile.fitness_goal,
          activity_level: profile.activity_level,
          age: profile.age,
          gender: profile.gender,
          dietary_restrictions: profile.dietary_restrictions,
          profile_picture: profile.profilePicture,
          created_at: profile.createdAt,
          updated_at: profile.updatedAt
        }
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

      // Validate that at least one field is provided
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one field must be provided for update'
        });
      }

      // Check if required fields are present for creating a new profile
      if (!updates.height || !updates.weight || !updates.fitness_goal || !updates.activity_level) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: height, weight, fitness_goal, and activity_level are required to create a profile'
        });
      }

      // Find profile or create a new one if it doesn't exist
      let profile = await Profile.findOne({ userId });
      if (!profile) {
        console.log('Profile not found, creating a new one');
        profile = new Profile({
          userId,
          ...updates
        });
      } else {
        // Update fields
        const allowedFields = [
          'height', 'weight', 'fitness_goal', 'activity_level', 
          'age', 'gender', 'dietary_restrictions', 'name'
        ];
        
        allowedFields.forEach(field => {
          if (updates[field] !== undefined) {
            profile[field] = updates[field];
          }
        });
      }

      await profile.save();

      // Get user info to include in response
      const user = req.user;

      res.json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name || user.username,
          height: profile.height,
          weight: profile.weight,
          fitness_goal: profile.fitness_goal,
          activity_level: profile.activity_level,
          age: profile.age,
          gender: profile.gender,
          dietary_restrictions: profile.dietary_restrictions,
          profile_picture: profile.profilePicture,
          updated_at: profile.updatedAt
        }
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

module.exports = { profileController, upload }; 