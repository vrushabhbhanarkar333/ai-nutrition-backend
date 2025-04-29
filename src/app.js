const express = require('express');
const cors = require('cors');
const path = require('path');
const foodRoutes = require('./routes/foodRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const stepsRoutes = require('./routes/stepsRoutes');
const profileRoutes = require('./routes/profileRoutes');
const mealRoutes = require('./routes/mealRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const fs = require('fs');

// Check if debug mode is enabled
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
if (DEBUG_MODE) {
  console.log('=================================================');
  console.log('🔍 DEBUG MODE ENABLED - Detailed logging active');
  console.log('=================================================');
}

const app = express();

// Middleware
app.use(cors());

// Custom JSON parser with better error handling
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({
        success: false,
        error: 'Invalid JSON format in request body. Please check your request format.'
      });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[REQUEST] ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  console.log(`[REQUEST] Body:`, req.body);
  
  // Add response logging
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - start;
    console.log(`[RESPONSE] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    return originalSend.call(this, body);
  };
  
  next();
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/food', foodRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/steps', stepsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} - ${err.name}: ${err.message}`);
  console.error(`[ERROR] Stack trace: ${err.stack}`);
  
  // Log request details that might have caused the error
  console.error(`[ERROR] Request body:`, req.body);
  console.error(`[ERROR] Request params:`, req.params);
  console.error(`[ERROR] Request query:`, req.query);
  
  // Send appropriate error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Something went wrong!',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;