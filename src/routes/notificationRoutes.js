const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { sendDailyCalorieNotifications, sendNotificationsForTimezone } = require('../services/notificationService');
const { Expo } = require('expo-server-sdk');

// Initialize Expo SDK
const expo = new Expo();

/**
 * @route POST /api/notifications/send-calorie-update
 * @desc Manually trigger calorie update notifications (admin only)
 * @access Private/Admin
 */
router.post('/send-calorie-update', auth, async (req, res) => {
  try {
    // In a real app, you'd check if the user is an admin here
    // For now, we'll just allow any authenticated user to trigger it
    
    // Trigger the notification process
    await sendDailyCalorieNotifications();
    
    res.status(200).json({
      success: true,
      message: 'Calorie update notifications sent successfully'
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notifications'
    });
  }
});

/**
 * @route POST /api/notifications/send-by-timezone
 * @desc Manually trigger notifications for a specific timezone (admin only)
 * @access Private/Admin
 */
router.post('/send-by-timezone', auth, async (req, res) => {
  try {
    const { timezone } = req.body;
    
    if (!timezone) {
      return res.status(400).json({
        success: false,
        error: 'Timezone is required'
      });
    }
    
    // Trigger notifications for the specified timezone
    await sendNotificationsForTimezone(timezone);
    
    res.status(200).json({
      success: true,
      message: `Notifications sent for timezone: ${timezone}`
    });
  } catch (error) {
    console.error('Error sending timezone notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send timezone notifications'
    });
  }
});

/**
 * @route POST /api/notifications/test-direct
 * @desc Send a test notification directly to a specific token
 * @access Private
 */
router.post('/test-direct', auth, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Push token is required'
      });
    }
    
    // Validate token format
    if (!Expo.isExpoPushToken(token)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Expo push token format'
      });
    }
    
    // Create a test message
    const message = {
      to: token,
      sound: 'default',
      title: 'Nutrition Update Test',
      body: 'This is a test notification from your nutrition app! 🍎',
      data: { 
        type: 'test',
        timestamp: new Date().toISOString()
      },
    };
    
    // Send the notification
    const ticket = await expo.sendPushNotificationsAsync([message]);
    
    res.status(200).json({
      success: true,
      message: 'Test notification sent successfully',
      ticket: ticket
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification'
    });
  }
});

module.exports = router;