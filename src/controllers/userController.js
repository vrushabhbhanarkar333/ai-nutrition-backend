const userService = require('../services/userService');

const userController = {
  register: async (req, res) => {
    console.log('[USER_CONTROLLER] Register attempt with email:', req.body.email);
    try {
      const { username, email, password } = req.body;
      
      // Validate input
      if (!username || !email || !password) {
        console.log('[USER_CONTROLLER] Registration failed: Missing required fields');
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }
      
      const result = await userService.registerUser(username, email, password);
      console.log('[USER_CONTROLLER] Registration successful for user:', email);
      res.status(201).json(result);
    } catch (error) {
      console.error('[USER_CONTROLLER] Registration error:', error.message);
      console.error('[USER_CONTROLLER] Error stack:', error.stack);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  },

  login: async (req, res) => {
    console.log('[USER_CONTROLLER] Login attempt with email:', req.body.email);
    try {
      const { email, password } = req.body;
      
      // Validate input
      if (!email || !password) {
        console.log('[USER_CONTROLLER] Login failed: Missing email or password');
        return res.status(400).json({ success: false, message: 'Email and password are required' });
      }
      
      const result = await userService.loginUser(email, password);
      console.log('[USER_CONTROLLER] Login successful for user:', email);
      res.json(result);
    } catch (error) {
      console.error('[USER_CONTROLLER] Login error:', error.message);
      console.error('[USER_CONTROLLER] Error stack:', error.stack);
      res.status(error.statusCode || 401).json({ success: false, message: error.message });
    }
  },

  getProfile: async (req, res) => {
    console.log('[USER_CONTROLLER] Get profile request for user ID:', req.user.id);
    try {
      const userId = req.user.id;
      const profile = await userService.getUserProfile(userId);
      console.log('[USER_CONTROLLER] Profile retrieved successfully for user ID:', userId);
      res.json(profile);
    } catch (error) {
      console.error('[USER_CONTROLLER] Get profile error:', error.message);
      console.error('[USER_CONTROLLER] Error stack:', error.stack);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  },

  updateProfile: async (req, res) => {
    console.log('[USER_CONTROLLER] Update profile request for user ID:', req.user.id);
    console.log('[USER_CONTROLLER] Update data:', req.body);
    try {
      const userId = req.user.id;
      const updates = req.body;
      
      // Validate input
      if (Object.keys(updates).length === 0) {
        console.log('[USER_CONTROLLER] Update profile failed: No update data provided');
        return res.status(400).json({ success: false, message: 'No update data provided' });
      }
      
      const updatedProfile = await userService.updateUserProfile(userId, updates);
      console.log('[USER_CONTROLLER] Profile updated successfully for user ID:', userId);
      res.json(updatedProfile);
    } catch (error) {
      console.error('[USER_CONTROLLER] Update profile error:', error.message);
      console.error('[USER_CONTROLLER] Error stack:', error.stack);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  },

  // Logout controller for stateless JWT
  logout: async (req, res) => {
    console.log('[USER_CONTROLLER] Logout request');
    res.json({ success: true, message: 'Logged out successfully' });
  }
};

module.exports = userController;