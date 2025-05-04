require('dotenv').config();
const { Expo } = require('expo-server-sdk');
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const { getRandomMessage } = require('../services/engagementService');

// Initialize Expo SDK
const expo = new Expo();

/**
 * Send a random engagement question to users
 * This function selects a random subset of users and sends them a random question
 */
const sendRandomEngagementQuestion = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');
    
    // Get a random engagement message
    const message = await getRandomMessage();
    if (!message) {
      console.error('No engagement message found');
      return;
    }
    
    console.log(`Selected question: "${message.message}" (Category: ${message.category})`);
    
    // Find all users with notification tokens
    const users = await User.find({ 
      notificationToken: { $exists: true, $ne: null } 
    });
    
    console.log(`Found ${users.length} users with notification tokens`);
    
    if (users.length === 0) {
      console.log('No users to notify');
      return;
    }
    
    // Randomly select a subset of users (between 25-50% of total users)
    const userSubsetPercentage = Math.random() * 0.25 + 0.25; // 25-50%
    const userSubsetSize = Math.max(1, Math.floor(users.length * userSubsetPercentage));
    
    // Shuffle users array and take the first subset
    const shuffledUsers = users.sort(() => 0.5 - Math.random());
    const selectedUsers = shuffledUsers.slice(0, userSubsetSize);
    
    console.log(`Randomly selected ${selectedUsers.length} users (${Math.round(userSubsetPercentage * 100)}% of total)`);
    
    // Prepare notifications
    const notifications = [];
    
    for (const user of selectedUsers) {
      // Skip if invalid token
      if (!Expo.isExpoPushToken(user.notificationToken)) {
        console.log(`Skipping user ${user._id} - invalid token`);
        continue;
      }
      
      // Add to notifications batch
      notifications.push({
        to: user.notificationToken,
        sound: 'default',
        title: 'Nutrition Coach',
        body: message.message,
        data: { 
          type: 'engagement',
          messageId: message._id.toString(),
          category: message.category
        },
      });
      
      console.log(`Prepared notification for user ${user._id}`);
    }
    
    if (notifications.length === 0) {
      console.log('No valid notifications to send');
      return;
    }
    
    // Send notifications in chunks (Expo recommends max 100 per batch)
    const chunks = expo.chunkPushNotifications(notifications);
    
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log(`Sent ${chunk.length} notifications`);
      } catch (error) {
        console.error('Error sending notifications:', error);
      }
    }
    
    console.log('Random engagement questions sent successfully');
  } catch (error) {
    console.error('Error sending random engagement questions:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// If run directly, send notifications immediately
if (require.main === module) {
  sendRandomEngagementQuestion();
} else {
  // Export for use in other modules
  module.exports = { sendRandomEngagementQuestion };
}