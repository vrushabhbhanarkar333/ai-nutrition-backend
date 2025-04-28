const { Expo } = require('expo-server-sdk');
const cron = require('node-cron');
const User = require('../models/User');
const DailyCalorie = require('../models/DailyCalorie');
const Profile = require('../models/Profile');

// Initialize Expo SDK
const expo = new Expo();

/**
 * Generate notification message based on calorie intake vs target
 * @param {Number} calories - Current calorie intake
 * @param {Number} target - Daily calorie target
 * @returns {String|null} - Notification message or null if no notification needed
 */
function generateNotificationMessage(calories, target) {
  if (!calories || !target) return null;
  
  const diff = calories - target;
  const percentComplete = (calories / target) * 100;
  
  // Under target by more than 30%
  if (percentComplete < 70) {
    return "You're under your calorie goal. Don't forget to eat! 🍎";
  }
  
  // Over target by more than 15%
  if (percentComplete > 115) {
    return "You're full of energy today! Keep it balanced 💪";
  }
  
  // Near target (within 10%)
  if (percentComplete >= 90 && percentComplete <= 110) {
    return "Great job! You're right on track with your nutrition goals today 👍";
  }
  
  return null;
}

/**
 * Send push notifications to users based on their calorie intake
 */
async function sendDailyCalorieNotifications() {
  try {
    console.log('Starting daily calorie notification process...');
    
    // Get current date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find all users with notification tokens
    const users = await User.find({ notificationToken: { $exists: true, $ne: null } });
    console.log(`Found ${users.length} users with notification tokens`);
    
    // Prepare notifications
    const notifications = [];
    
    for (const user of users) {
      // Get user's calorie data for today
      const calorieData = await DailyCalorie.findOne({
        userId: user._id,
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      });
      
      // Get user's profile for calorie target
      const profile = await Profile.findOne({ userId: user._id });
      
      // Default target if not available
      let calorieTarget = 2000;
      
      // Calculate target based on profile if available
      if (profile) {
        // Basic BMR calculation using Harris-Benedict equation
        let bmr = 0;
        if (profile.gender === 'male') {
          bmr = 88.362 + (13.397 * profile.weight) + (4.799 * profile.height) - (5.677 * profile.age);
        } else {
          bmr = 447.593 + (9.247 * profile.weight) + (3.098 * profile.height) - (4.330 * profile.age);
        }
        
        // Apply activity multiplier
        const activityMultipliers = {
          sedentary: 1.2,
          light: 1.375,
          moderate: 1.55,
          active: 1.725,
          very_active: 1.9
        };
        
        const multiplier = activityMultipliers[profile.activity_level] || 1.2;
        calorieTarget = Math.round(bmr * multiplier);
        
        // Adjust based on fitness goal
        if (profile.fitness_goal === 'lose_weight') {
          calorieTarget -= 500; // Deficit for weight loss
        } else if (profile.fitness_goal === 'gain_weight' || profile.fitness_goal === 'build_muscle') {
          calorieTarget += 500; // Surplus for weight gain
        }
      }
      
      // Current calories consumed today
      const currentCalories = calorieData ? calorieData.totalCalories : 0;
      
      // Generate message
      const message = generateNotificationMessage(currentCalories, calorieTarget);
      
      // Skip if no message or invalid token
      if (!message || !Expo.isExpoPushToken(user.notificationToken)) {
        continue;
      }
      
      // Add to notifications batch
      notifications.push({
        to: user.notificationToken,
        sound: 'default',
        title: 'Nutrition Update',
        body: message,
        data: { 
          type: 'daily_summary',
          currentCalories,
          calorieTarget
        },
      });
      
      console.log(`Prepared notification for user ${user._id}`);
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
    
    console.log('Daily calorie notification process completed');
  } catch (error) {
    console.error('Error in notification service:', error);
  }
}

/**
 * Send notifications to users in a specific timezone
 * @param {String} timezone - The timezone to target
 */
async function sendNotificationsForTimezone(timezone) {
  try {
    console.log(`Sending notifications for timezone: ${timezone}`);
    
    // Find users in this timezone with notification tokens
    const users = await User.find({ 
      timezone: timezone,
      notificationToken: { $exists: true, $ne: null } 
    });
    
    console.log(`Found ${users.length} users in timezone ${timezone}`);
    
    if (users.length === 0) return;
    
    // Get current date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Prepare notifications
    const notifications = [];
    
    for (const user of users) {
      // Get user's calorie data for today
      const calorieData = await DailyCalorie.findOne({
        userId: user._id,
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      });
      
      // Get user's profile for calorie target
      const profile = await Profile.findOne({ userId: user._id });
      
      // Default target if not available
      let calorieTarget = 2000;
      
      // Calculate target based on profile if available
      if (profile) {
        // Basic BMR calculation using Harris-Benedict equation
        let bmr = 0;
        if (profile.gender === 'male') {
          bmr = 88.362 + (13.397 * profile.weight) + (4.799 * profile.height) - (5.677 * profile.age);
        } else {
          bmr = 447.593 + (9.247 * profile.weight) + (3.098 * profile.height) - (4.330 * profile.age);
        }
        
        // Apply activity multiplier
        const activityMultipliers = {
          sedentary: 1.2,
          light: 1.375,
          moderate: 1.55,
          active: 1.725,
          very_active: 1.9
        };
        
        const multiplier = activityMultipliers[profile.activity_level] || 1.2;
        calorieTarget = Math.round(bmr * multiplier);
        
        // Adjust based on fitness goal
        if (profile.fitness_goal === 'lose_weight') {
          calorieTarget -= 500; // Deficit for weight loss
        } else if (profile.fitness_goal === 'gain_weight' || profile.fitness_goal === 'build_muscle') {
          calorieTarget += 500; // Surplus for weight gain
        }
      }
      
      // Current calories consumed today
      const currentCalories = calorieData ? calorieData.totalCalories : 0;
      
      // Generate message
      const message = generateNotificationMessage(currentCalories, calorieTarget);
      
      // Skip if no message or invalid token
      if (!message || !Expo.isExpoPushToken(user.notificationToken)) {
        continue;
      }
      
      // Add to notifications batch
      notifications.push({
        to: user.notificationToken,
        sound: 'default',
        title: 'Nutrition Update',
        body: message,
        data: { 
          type: 'daily_summary',
          currentCalories,
          calorieTarget
        },
      });
      
      console.log(`Prepared notification for user ${user._id}`);
    }
    
    // Send notifications in chunks (Expo recommends max 100 per batch)
    const chunks = expo.chunkPushNotifications(notifications);
    
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log(`Sent ${chunk.length} notifications for timezone ${timezone}`);
      } catch (error) {
        console.error(`Error sending notifications for timezone ${timezone}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error processing timezone ${timezone}:`, error);
  }
}

/**
 * Initialize notification schedules
 */
function initNotificationSchedules() {
  // Schedule daily at 8 PM for each timezone
  cron.schedule('0 * * * *', async () => {
    try {
      // Get current hour
      const currentHour = new Date().getUTCHours();
      
      // Find all timezones where it's currently 8 PM
      // This is a simplified approach - in a production app, you'd use a proper timezone library
      const targetTimezones = [];
      
      // Common timezone offsets (simplified)
      const timezoneMap = {
        'UTC': 0,
        'America/New_York': -5,
        'America/Chicago': -6,
        'America/Denver': -7,
        'America/Los_Angeles': -8,
        'Europe/London': 0,
        'Europe/Paris': 1,
        'Europe/Berlin': 1,
        'Asia/Tokyo': 9,
        'Asia/Shanghai': 8,
        'Asia/Kolkata': 5.5,
        'Australia/Sydney': 10
      };
      
      // Find timezones where it's currently 8 PM
      for (const [timezone, offset] of Object.entries(timezoneMap)) {
        const localHour = (currentHour + offset + 24) % 24;
        if (localHour === 20) { // 8 PM
          targetTimezones.push(timezone);
        }
      }
      
      console.log(`It's 8 PM in these timezones: ${targetTimezones.join(', ')}`);
      
      // Send notifications for each timezone where it's 8 PM
      for (const timezone of targetTimezones) {
        await sendNotificationsForTimezone(timezone);
      }
      
      // Also handle users with unknown timezones at 8 PM UTC
      if (currentHour === 20) {
        await sendNotificationsForTimezone(null);
        await sendNotificationsForTimezone('UTC');
      }
    } catch (error) {
      console.error('Error in scheduled notification task:', error);
    }
  });
  
  console.log('Notification service initialized - scheduled for 8 PM in each timezone');
  
  // For testing purposes, you can uncomment this to run immediately
  // sendDailyCalorieNotifications();
}

module.exports = {
  initNotificationSchedules,
  sendDailyCalorieNotifications,
  sendNotificationsForTimezone,
  generateNotificationMessage
};