const User = require('../models/User');
const jwt = require('jsonwebtoken');
const userService = require('../services/userService');

const userController = {
  register: async (req, res) => {
    try {
      const { username, email, password, dailyStepGoal, preferences } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [{ email }, { username }] 
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User with this email or username already exists'
        });
      }

      // Create new user
      const user = new User({
        username,
        email,
        password,
        dailyStepGoal: dailyStepGoal || 10000,
        preferences
      });

      // Save user to database
      await user.save();
      console.log(`New user created: ${user._id} (${username})`);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            dailyStepGoal: user.dailyStepGoal,
            preferences: user.preferences
          }
        }
      });
    } catch (error) {
      console.error('Error in user registration:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      console.log(`User logged in: ${user._id} (${user.username})`);

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            dailyStepGoal: user.dailyStepGoal,
            preferences: user.preferences
          }
        }
      });
    } catch (error) {
      console.error('Error in user login:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  getProfile: async (req, res) => {
    try {
      // User is already available from auth middleware
      const user = req.user;
      
      res.json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          dailyStepGoal: user.dailyStepGoal,
          preferences: user.preferences,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Error getting user profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  updateProfile: async (req, res) => {
    try {
      const { username, dailyStepGoal, preferences } = req.body;
      const userId = req.user._id;

      // Find user and update
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Update fields
      if (username) user.username = username;
      if (dailyStepGoal) user.dailyStepGoal = dailyStepGoal;
      if (preferences) user.preferences = preferences;

      await user.save();
      console.log(`User updated: ${user._id}`);

      res.json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          dailyStepGoal: user.dailyStepGoal,
          preferences: user.preferences
        }
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  updateNotificationToken: async (req, res) => {
    try {
      const { notificationToken } = req.body;
      const userId = req.user._id;

      // Find user and update
      const user = await User.findByIdAndUpdate(
        userId, 
        { notificationToken }, 
        { new: true }
      );
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      console.log(`Notification token updated for user: ${user._id}`);

      res.json({
        success: true,
        data: {
          message: 'Notification token updated successfully'
        }
      });
    } catch (error) {
      console.error('Error updating notification token:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Logout controller for stateless JWT
  logout: async (req, res) => {
    console.log('[USER_CONTROLLER] Logout request');
    res.json({ success: true, message: 'Logged out successfully' });
  }
};

module.exports = userController;