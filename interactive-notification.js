const { Expo } = require('expo-server-sdk');
const readline = require('readline');

// Create a new Expo SDK client
const expo = new Expo();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Main function to gather notification details and send
async function sendNotification() {
  try {
    console.log('=== Interactive Notification Sender ===\n');
    
    // Get notification details from user
    const title = await prompt('Enter notification title (or press Enter for default): ');
    const body = await prompt('Enter notification body (or press Enter for default): ');
    
    let customData = {};
    const addCustomData = await prompt('Do you want to add custom data? (y/n): ');
    
    if (addCustomData.toLowerCase() === 'y') {
      console.log('Enter custom data in key:value format (one per line). Type "done" when finished.');
      let inputting = true;
      
      while (inputting) {
        const dataInput = await prompt('> ');
        if (dataInput.toLowerCase() === 'done') {
          inputting = false;
        } else {
          const [key, value] = dataInput.split(':').map(item => item.trim());
          if (key && value) {
            // Try to parse value as number or boolean if possible
            if (value === 'true') customData[key] = true;
            else if (value === 'false') customData[key] = false;
            else if (!isNaN(value)) customData[key] = Number(value);
            else customData[key] = value;
          }
        }
      }
    }
    
    // The Expo push token from your device
    const pushToken = 'ExponentPushToken[0BR76-OeuaZ0ciKhpetwnp]';
    
    // Check that the token is valid
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      rl.close();
      return;
    }
    
    // Create a message with custom content
    const message = {
      to: pushToken,
      sound: 'default',
      title: title || 'Hello from AI Nutrition!',
      body: body || 'This is a test notification from your nutrition app! 🍎',
      data: { 
        type: 'test',
        timestamp: new Date().toISOString(),
        ...customData
      },
    };
    
    console.log('\nPreparing to send notification with:');
    console.log(`Title: ${message.title}`);
    console.log(`Body: ${message.body}`);
    console.log(`Data: ${JSON.stringify(message.data)}`);
    
    const confirm = await prompt('\nSend this notification? (y/n): ');
    
    if (confirm.toLowerCase() === 'y') {
      console.log('Sending push notification...');
      const ticket = await expo.sendPushNotificationsAsync([message]);
      console.log('Notification sent successfully!');
      console.log('Response:', ticket);
    } else {
      console.log('Notification cancelled.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
  }
}

// Run the main function
sendNotification();