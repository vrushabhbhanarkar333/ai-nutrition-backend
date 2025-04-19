require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');
const connectDB = require('./config/database');

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

const PORT = process.env.PORT || 3000;

const findAvailablePort = async (port) => {
  const net = require('net');
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(findAvailablePort(port + 1)));
    server.listen(port, () => server.close(() => resolve(port)));
  });
};

const startServer = async () => {
  try {
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
