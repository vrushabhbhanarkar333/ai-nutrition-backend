const jwt = require('jsonwebtoken');

const authMiddleware = {
  authenticateToken: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token is required' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Set the user object with both _id and userId for compatibility
      req.user = {
        ...decoded,
        _id: decoded.userId // Add _id property for backward compatibility
      };
      
      next();
    } catch (error) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
  },

  validateRegisterInput: (req, res, next) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    next();
  }
};

module.exports = authMiddleware; 