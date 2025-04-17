const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock database
let users = [];

const userService = {
  registerUser: async (username, email, password) => {
    console.log('[USER_SERVICE] Register user request for:', email);
    
    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      console.log('[USER_SERVICE] Registration failed: Email already exists:', email);
      const error = new Error('User already exists');
      error.statusCode = 409; // Conflict
      throw error;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const user = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      createdAt: new Date(),
      preferences: {
        dietaryRestrictions: [],
        favoriteCuisines: []
      }
    };

    // Add user to database
    users.push(user);
    console.log('[USER_SERVICE] User added to database with ID:', user.id);

    // Generate JWT token
    console.log('[USER_SERVICE] Generating JWT token for user:', user.id);
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    console.log('[USER_SERVICE] JWT token generated successfully');

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        preferences: user.preferences
      },
      token
    };
  },

  loginUser: async (email, password) => {
    // Find user in database
    const user = users.find(user => user.email === email);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        preferences: user.preferences
      },
      token
    };
  },

  getUserProfile: async (userId) => {
    const user = users.find(user => user.id === userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      preferences: user.preferences,
      createdAt: user.createdAt
    };
  },

  updateUserProfile: async (userId, updates) => {
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    // Update user data
    users[userIndex] = {
      ...users[userIndex],
      ...updates,
      updatedAt: new Date()
    };

    return {
      id: users[userIndex].id,
      username: users[userIndex].username,
      email: users[userIndex].email,
      preferences: users[userIndex].preferences,
      updatedAt: users[userIndex].updatedAt
    };
  }
};

module.exports = userService; 