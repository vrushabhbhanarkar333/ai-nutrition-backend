require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const EngagementMessage = require('../models/EngagementMessage');
const { initializeEngagementMessages, getRandomMessage, getRandomMessagesByCategory } = require('../services/engagementService');

const testEngagement = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');
    
    // Initialize engagement messages
    await initializeEngagementMessages();
    console.log('Engagement messages initialized');
    
    // Get all messages
    const allMessages = await EngagementMessage.find();
    console.log(`\nTotal messages: ${allMessages.length}`);
    
    // Count by category
    const categories = ['meal_reminder', 'fitness', 'progress', 'hydration', 'evening'];
    for (const category of categories) {
      const count = await EngagementMessage.countDocuments({ category });
      console.log(`${category}: ${count} messages`);
    }
    
    // Test getting a random message
    console.log('\nTesting random message retrieval:');
    const randomMessage = await getRandomMessage();
    console.log('Random message:', randomMessage ? {
      id: randomMessage._id,
      category: randomMessage.category,
      message: randomMessage.message
    } : 'No message found');
    
    // Test getting a random message from each category
    console.log('\nTesting random message by category:');
    const randomMessages = await getRandomMessagesByCategory();
    for (const category of categories) {
      const message = randomMessages[category];
      console.log(`${category}: ${message ? message.message : 'No message found'}`);
    }
    
    console.log('\nEngagement test completed successfully');
  } catch (error) {
    console.error('Error testing engagement:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

testEngagement();