const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
const expo = new Expo();

// Get command line arguments for customization
const args = process.argv.slice(2);
const customTitle = args[0] || 'Hello from AI Nutrition!';
const customBody = args[1] || 'This is a test notification from your nutrition app! 🍎';
const customData = args[2] ? JSON.parse(args[2]) : {};

// The Expo push token from your device
const pushToken = 'ExponentPushToken[0BR76-OeuaZ0ciKhpetwnp]';

// Check that the token is valid
if (!Expo.isExpoPushToken(pushToken)) {
  console.error(`Push token ${pushToken} is not a valid Expo push token`);
  process.exit(1);
}

// Create a message with custom content
const message = {
  to: pushToken,
  sound: 'default',
  title: customTitle,
  body: customBody,
  data: { 
    type: 'test',
    timestamp: new Date().toISOString(),
    ...customData
  },
};

console.log('Preparing to send notification with:');
console.log(`Title: ${message.title}`);
console.log(`Body: ${message.body}`);
console.log(`Data: ${JSON.stringify(message.data)}`);

// Send the notification
(async () => {
  try {
    console.log('Sending push notification...');
    const ticket = await expo.sendPushNotificationsAsync([message]);
    console.log('Notification sent successfully!');
    console.log('Response:', ticket);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
})();