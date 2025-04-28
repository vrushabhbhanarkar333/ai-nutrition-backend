require('dotenv').config();
const mongoose = require('mongoose');
const { Expo } = require('expo-server-sdk');
const User = require('../models/User');
const DailyCalorie = require('../models/DailyCalorie');
const connectDB = require('../config/database');

// Initialize Expo SDK
const expo = new Expo();

async function testNotifications() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database');

    // Test user with a valid Expo push token
    const testToken = process.argv[2] || 'ExponentPushToken[XXXXXXXXXXXXXXXXXXXXXX]';
    
    if (!Expo.isExpoPushToken(testToken)) {
      console.error('Invalid Expo push token format. Token should be in format: ExponentPushToken[XXXXXXXXXXXXXXXXXXXXXX]');
      process.exit(1);
    }

    console.log(`Using test token: ${testToken}`);

    // Create a test message
    const message = {
      to: testToken,
      sound: 'default',
      title: 'Nutrition Update Test',
      body: 'This is a test notification from your nutrition app! 🍎',
      data: { 
        type: 'test',
        timestamp: new Date().toISOString()
      },
    };

    // Send the notification
    try {
      console.log('Sending test notification...');
      const ticket = await expo.sendPushNotificationsAsync([message]);
      console.log('Notification sent successfully!');
      console.log('Response:', ticket);
    } catch (error) {
      console.error('Error sending notification:', error);
    }

    // Disconnect from database
    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

// Run the test
testNotifications();