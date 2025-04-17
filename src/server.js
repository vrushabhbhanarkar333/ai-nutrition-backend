require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

// Connect to MongoDB
console.log('[DATABASE] Attempting to connect to MongoDB...');
connectDB()
  .then(() => console.log('[DATABASE] MongoDB connection successful'))
  .catch(err => console.error('[DATABASE] MongoDB connection failed:', err));

// Make sure PORT is a number
const PORT = parseInt(process.env.PORT) || 3000;

// Function to find an available port
const findAvailablePort = async (port) => {
  // Ensure port is a valid number
  port = parseInt(port);
  if (isNaN(port) || port < 0 || port >= 65536) {
    console.log(`[SERVER] Invalid port ${port}, using default port 3000`);
    port = 3000;
  }
  
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
    console.log(`[SERVER] Attempting to start server on port ${PORT}...`);
    const availablePort = await findAvailablePort(PORT);
    const server = app.listen(availablePort, () => {
      console.log(`[SERVER] Server is running on port ${availablePort}`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[SERVER] API endpoints available at http://localhost:${availablePort}/api/`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`[SERVER] Port ${availablePort} is in use, trying next port...`);
        startServer();
      } else {
        console.error('[SERVER] Server error:', error);
        console.error('[SERVER] Error stack:', error.stack);
      }
    });

    // Handle process termination
    process.on('SIGTERM', () => {
      console.log('[SERVER] SIGTERM received. Shutting down gracefully');
      server.close(() => {
        console.log('[SERVER] Process terminated');
      });
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('[SERVER] UNCAUGHT EXCEPTION! ');
      console.error('[SERVER] Error:', error.name, error.message);
      console.error('[SERVER] Error stack:', error.stack);
      console.log('[SERVER] Shutting down...');
      server.close(() => {
        process.exit(1);
      });
    });
    
    // Handle unhandled rejections
    process.on('unhandledRejection', (error) => {
      console.error('[SERVER] UNHANDLED REJECTION! ');
      console.error('[SERVER] Error:', error);
      console.log('[SERVER] Shutting down...');
      server.close(() => {
        process.exit(1);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 