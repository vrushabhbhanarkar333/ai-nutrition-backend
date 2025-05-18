const User = require('../models/User');
const Profile = require('../models/Profile');
const jwt = require('jsonwebtoken');
const userService = require('../services/userService');

const userController = {
  register: async (req, res) => {
    try {
      // Log the raw request body for debugging
      console.log('Registration request body:', req.body);
      
      // Validate that required fields are present
      const { username, email, password, name, dailyStepGoal, preferences } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username, email, and password are required'
        });
      }

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
        name: name || username, // Use name if provided, otherwise use username
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
            name: user.name,
            email: user.email,
            dailyStepGoal: user.dailyStepGoal,
            preferences: user.preferences,
            created_at: user.createdAt
          }
        }
      });
    } catch (error) {
      console.error('Error in user registration:', error);
      
      // Provide more specific error message for JSON parsing errors
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON format in request body. Please check your request format.'
        });
      }
      
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

      // Check if user has a profile and get the profile data
      let profileData = null;
      try {
        const profile = await Profile.findOne({ userId: user._id });
        if (profile) {
          profileData = {
            height: profile.height,
            weight: profile.weight,
            fitness_goal: profile.fitness_goal,
            activity_level: profile.activity_level,
            age: profile.age,
            gender: profile.gender,
            profile_picture: profile.profilePicture?.url || null
          };
        }
      } catch (profileError) {
        console.log('Error fetching profile during login:', profileError);
        // Continue with login even if profile fetch fails
      }

      // Create user response object with clear name field
      const userData = {
        id: user._id,
        username: user.username,
        name: user.name || user.username, // Include name field, fallback to username if not set
        email: user.email,
        dailyStepGoal: user.dailyStepGoal,
        preferences: user.preferences
      };

      // Add profile data if available
      if (profileData) {
        Object.assign(userData, profileData);
      }

      res.json({
        success: true,
        data: {
          token,
          user: userData
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
          name: user.name,
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
      const { username, dailyStepGoal, preferences, name } = req.body;
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
      if (name) user.name = name;
      if (dailyStepGoal) user.dailyStepGoal = dailyStepGoal;
      if (preferences) user.preferences = preferences;

      await user.save();
      console.log(`User updated: ${user._id}`);

      res.json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          name: user.name,
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
      const { notificationToken, timezone } = req.body;
      const userId = req.user._id;

      // Prepare update object
      const updateData = {};
      if (notificationToken !== undefined) updateData.notificationToken = notificationToken;
      if (timezone !== undefined) updateData.timezone = timezone;

      // Find user and update
      const user = await User.findByIdAndUpdate(
        userId, 
        updateData, 
        { new: true }
      );
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      console.log(`Notification settings updated for user: ${user._id}`);
      console.log(`Token: ${notificationToken ? 'Updated' : 'Not updated'}, Timezone: ${timezone || 'Not updated'}`);

      res.json({
        success: true,
        data: {
          message: 'Notification settings updated successfully',
          notificationToken: user.notificationToken,
          timezone: user.timezone
        }
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
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
  },

  // New method for implementing registration with profile in a single step
  registerWithProfile: async (req, res) => {
    try {
      // Validate user registration data
      const { username, email, password, name } = req.body.user;
      
      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username, email, and password are required'
        });
      }

      // Check if user already exists with this email
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'A user with this email already exists'
        });
      }
      
      // Check if user already exists with this username
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          error: 'This username is already taken, please choose a different one'
        });
      }

      // Validate profile data
      const { 
        height, 
        weight, 
        fitness_goal, 
        activity_level, 
        age, 
        gender, 
        dietary_restrictions 
      } = req.body.profile;

      if (!height || !weight || !fitness_goal || !activity_level) {
        return res.status(400).json({
          success: false,
          error: 'Missing required profile fields: height, weight, fitness_goal, and activity_level are required'
        });
      }

      // Create new user
      const user = new User({
        username,
        email,
        name: name || username, // Keep name separate from username
        password
      });

      // Save user to database
      await user.save();
      console.log(`New user created with profile: ${user._id} (${username})`);

      // Create profile for the user
      const profile = new Profile({
        userId: user._id,
        height,
        weight,
        fitness_goal,
        activity_level,
        age,
        gender,
        dietary_restrictions
      });

      // Save profile to database
      await profile.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      // Create a user object with profile data included
      const userWithProfile = {
        id: user._id,
        username: user.username,
        name: user.name,  // Ensure name is included
        email: user.email,
        height: profile.height,
        weight: profile.weight,
        fitness_goal: profile.fitness_goal,
        activity_level: profile.activity_level,
        age: profile.age,
        gender: profile.gender,
        dietary_restrictions: profile.dietary_restrictions,
        created_at: user.createdAt
      };

      // Return success response with token and user data
      res.status(201).json({
        success: true,
        data: {
          token,
          user: userWithProfile
        }
      });
    } catch (error) {
      console.error('Error in registering user with profile:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Check if an email is already registered
  checkEmailExists: async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }
      
      // Check if a user with this email exists
      const user = await User.findOne({ email });
      
      // Return result without exposing user details
      return res.status(200).json({
        success: true,
        exists: !!user
      });
    } catch (error) {
      console.error('Error checking email existence:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = userController;