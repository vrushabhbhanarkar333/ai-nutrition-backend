require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const { initNotificationSchedules } = require('./services/notificationService');
const { initializeChatTable } = require('./services/chatService');

const verifyDBConnection = async () => {
  try {
    console.log('Verifying database connection...');
    if (mongoose.connection.readyState !== 1) {
      console.log('Not connected, attempting to connect...');
      await connectDB();
    }

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Database collections:', collections.map(c => c.name).join(', '));

    console.log('Database connection verified successfully.');
    return true;
  } catch (error) {
    console.error('Database verification failed:', error);
    return false;
  }
};

let PORT = parseInt(process.env.PORT || '3000', 10);
if (isNaN(PORT) || PORT < 0 || PORT > 65535) {
  console.error('Invalid port specified. Using default port 3000');
  PORT = 3000;
}

// Use a fixed port for consistency with mobile app
const PORT_FOR_MOBILE = 3001;

const findAvailablePort = async (port) => {
  // Always use PORT_FOR_MOBILE for consistency with mobile app
  return PORT_FOR_MOBILE;
};

const startServer = async () => {
  try {
    // Ensure upload directories exist
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '..', 'uploads');
    const chatImagesDir = path.join(uploadDir, 'chat-images');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('Created uploads directory');
    }
    
    if (!fs.existsSync(chatImagesDir)) {
      fs.mkdirSync(chatImagesDir, { recursive: true });
      console.log('Created chat-images directory');
    }
    
    const dbConnected = await verifyDBConnection();
    if (!dbConnected) {
      console.error('Could not establish database connection. Server will not start.');
      process.exit(1);
    }

    const availablePort = await findAvailablePort(PORT);
    // Listen on all network interfaces (0.0.0.0) so it's accessible from mobile devices
    const server = app.listen(availablePort, '0.0.0.0', () => {
      console.log(`Server is running on port ${availablePort}`);
      console.log(`API URL: http://localhost:${availablePort}/api`);
      
      // Get local IP address for mobile testing
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      const results = {};
      
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
          if (net.family === 'IPv4' && !net.internal) {
            if (!results[name]) {
              results[name] = [];
            }
            results[name].push(net.address);
          }
        }
      }
      
      console.log('Network interfaces:', results);
      console.log(`For mobile testing, use: http://<your-local-ip>:${availablePort}/api`);
      
      // Initialize notification schedules
      initNotificationSchedules();
      
      // Initialize vector database tables
      try {
        console.log('Initializing vector database tables...');
        const { initializeVectorTable } = require('./services/embeddingService');
        
        // Initialize both tables
        Promise.all([
          initializeChatTable(),
          initializeVectorTable()
        ])
          .then(() => console.log('Vector database tables initialized successfully'))
          .catch(err => console.error('Error initializing vector database:', err));
      } catch (error) {
        console.error('Failed to initialize vector database:', error);
      }
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${availablePort} is in use, trying next port...`);
        startServer();
      } else {
        console.error('Server error:', error);
      }
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        mongoose.connection.close(false, () => {
          console.log('MongoDB connection closed. Process terminated.');
        });
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
