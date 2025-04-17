require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');
const connectDB = require('./config/database');

// Connect to MongoDB and verify connection
const verifyDBConnection = async () => {
  try {
    console.log('Verifying database connection...');
    // Check if we're connected
    if (mongoose.connection.readyState !== 1) {
      console.log('Not connected, attempting to connect...');
      await connectDB();
    }
    
    // Test database operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Database collections:', collections.map(c => c.name).join(', '));
    
    console.log('Database connection verified successfully.');
    return true;
  } catch (error) {
    console.error('Database verification failed:', error);
    return false;
  }
};

const PORT = process.env.PORT || 3000;

// Function to find an available port
const findAvailablePort = async (port) => {
  const net = require('net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      // Port is in use, try next port
      resolve(findAvailablePort(port + 1));
    });
    server.listen(port, () => {
      server.close(() => {
        resolve(port);
      });
    });
  });
};

// Start server
const startServer = async () => {
  try {
    // Verify DB connection first
    const dbConnected = await verifyDBConnection();
    if (!dbConnected) {
      console.error('Could not establish database connection. Server will not start.');
      process.exit(1);
    }
    
    const availablePort = await findAvailablePort(PORT);
    const server = app.listen(availablePort, () => {
      console.log(`Server is running on port ${availablePort}`);
      console.log(`API URL: http://localhost:${availablePort}/api`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${availablePort} is in use, trying next port...`);
        startServer();
      } else {
        console.error('Server error:', error);
      }
    });

    // Handle process termination
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully');
      server.close(() => {
        mongoose.connection.close(false, () => {
          console.log('MongoDB connection closed.');
          console.log('Process terminated');
        });
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 