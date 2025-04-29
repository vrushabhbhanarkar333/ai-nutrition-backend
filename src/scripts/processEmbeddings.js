require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const processUnembeddedMessages = require('../utils/processUnembeddedMessages');

async function main() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database successfully.');
    
    console.log('Starting to process unembedded messages...');
    const result = await processUnembeddedMessages();
    
    console.log('Processing completed:', result);
    
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error in processing embeddings:', error);
    
    // Close the database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('Database connection closed.');
    }
    
    process.exit(1);
  }
}

// Run the script
main();