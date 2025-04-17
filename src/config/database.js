const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Log the MongoDB URI (hide credentials for security)
    const uriParts = process.env.MONGODB_URI.split('@');
    const safeUri = uriParts.length > 1 
      ? `mongodb+srv://****:****@${uriParts[1]}` 
      : 'mongodb+srv://****:****@[hidden]';
    
    console.log(`Connecting to MongoDB: ${safeUri}`);
    
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
    
    // Setup connection monitoring
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
      setTimeout(connectDB, 5000);
    });
    
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB; 