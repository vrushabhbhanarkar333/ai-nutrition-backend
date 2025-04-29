const Profile = require('../models/Profile');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');

// Configure multer for memory storage (for Cloudinary uploads)
const storage = multer.memoryStorage();
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
  // Check if user profile exists
  checkProfileExists: async (req, res) => {
    try {
      const userId = req.user._id;
      const profile = await Profile.findOne({ userId });
      
      res.json({
        success: true,
        data: {
          profileExists: !!profile,
          userId: userId
        }
      });
    } catch (error) {
      console.error('Error checking profile existence:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

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

      const userId = req.user._id;

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
          profile_picture: profile.profilePicture?.url || null,
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
          profile_picture: profile.profilePicture?.url || null,
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

      // Find profile or create a new one if it doesn't exist
      let profile = await Profile.findOne({ userId });
      if (!profile) {
        // Check if required fields are present for creating a new profile
        if (!updates.height || !updates.weight || !updates.fitness_goal || !updates.activity_level) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: height, weight, fitness_goal, and activity_level are required to create a profile'
          });
        }

        console.log('Profile not found, creating a new one');
        profile = new Profile({
          userId,
          ...updates
        });
      } else {
        // Update fields
        const allowedFields = [
          'height', 'weight', 'fitness_goal', 'activity_level', 
          'age', 'gender', 'dietary_restrictions'
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
          profile_picture: profile.profilePicture?.url || null,
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

      // Delete old image from Cloudinary if exists
      if (profile.profilePicture?.publicId) {
        await cloudinary.uploader.destroy(profile.profilePicture.publicId);
      }

      // Convert buffer to base64 for Cloudinary upload
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;

      // Upload to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: 'profile_pictures',
        resource_type: 'auto'
      });

      // Update profile with new picture URL and public ID
      profile.profilePicture = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id
      };

      await profile.save();

      res.json({
        success: true,
        data: {
          profile_picture: profile.profilePicture.url
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