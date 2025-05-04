require('dotenv').config();
const { Expo } = require('expo-server-sdk');
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const { getRandomMessage } = require('../services/engagementService');

// Initialize Expo SDK
const expo = new Expo();

/**
 * Send engagement notifications to users
 * @param {String} category - Optional category to filter messages
 */
const sendEngagementNotifications = async (category = null) => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');
    
    // Get a random engagement message
    const message = await getRandomMessage(category);
    if (!message) {
      console.error('No engagement message found');
      return;
    }
    
    console.log(`Selected message: "${message.message}" (Category: ${message.category})`);
    
    // Find all users with notification tokens
    const users = await User.find({ 
      notificationToken: { $exists: true, $ne: null } 
    });
    
    console.log(`Found ${users.length} users with notification tokens`);
    
    if (users.length === 0) {
      console.log('No users to notify');
      return;
    }
    
    // Prepare notifications
    const notifications = [];
    
    for (const user of users) {
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
        console.log('Notification tickets:', ticketChunk);
      } catch (error) {
        console.error('Error sending notifications:', error);
      }
    }
    
    console.log('Engagement notifications sent successfully');
  } catch (error) {
    console.error('Error sending engagement notifications:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Get category from command line arguments
const category = process.argv[2];
sendEngagementNotifications(category);