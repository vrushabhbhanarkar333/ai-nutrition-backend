const EngagementMessage = require('../models/EngagementMessage');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');

const ENDPOINT_SERVICE = 'engagementService';

// Initialize the engagement messages with default messages
const initializeEngagementMessages = async () => {
  try {
    console.log('Initializing engagement messages...');
    
    // Check if we already have messages
    const count = await EngagementMessage.countDocuments();
    if (count > 0) {
      console.log(`Found ${count} existing engagement messages. Skipping initialization.`);
      return;
    }
    
    // Default messages by category
    const defaultMessages = [
      // Meal Reminders & Nutrition Check-ins
      { 
        category: 'meal_reminder', 
        message: "What's on your plate today? Let me check if it fits your goals 🍽️" 
      },
      { 
        category: 'meal_reminder', 
        message: "Time for lunch! Want a quick suggestion based on your plan?" 
      },
      { 
        category: 'meal_reminder', 
        message: "Skipped breakfast? Let's fix that — I can help you choose something quick 🥣" 
      },
      
      // Fitness Engagement
      { 
        category: 'fitness', 
        message: "Ready to move? I've got a 15-min workout just for you 💥" 
      },
      { 
        category: 'fitness', 
        message: "Missed your steps goal yesterday — shall we plan an active break now?" 
      },
      { 
        category: 'fitness', 
        message: "Let's stretch it out. 5-minute mobility session?" 
      },
      
      // Progress & Motivation Nudges
      { 
        category: 'progress', 
        message: "You're 70% to your weekly goal — want tips to finish strong?" 
      },
      { 
        category: 'progress', 
        message: "Check-in time! How's your energy today? Let's log it 💬" 
      },
      { 
        category: 'progress', 
        message: "Every meal you log helps me learn you better. Want to log now?" 
      },
      
      // Hydration & Wellness
      { 
        category: 'hydration', 
        message: "Hydration check! Have you had water in the last hour? 💧" 
      },
      { 
        category: 'hydration', 
        message: "Mental energy low? Let's talk — I might have a quick fix 🧠" 
      },
      
      // Evening Wrap-ups
      { 
        category: 'evening', 
        message: "How did the day go? Let's review your meals and activity 📋" 
      },
      { 
        category: 'evening', 
        message: "Feeling cravings at night? I've got some healthy snack hacks 😋" 
      }
    ];
    
    // Insert all default messages
    await EngagementMessage.insertMany(defaultMessages);
    
    console.log(`Successfully initialized ${defaultMessages.length} engagement messages`);
  } catch (error) {
    console.error('Error initializing engagement messages:', error);
  }
};

// Get a random engagement message
const getRandomMessage = async (category = null) => {
  try {
    logRequest(`${ENDPOINT_SERVICE}.getRandomMessage`, { category });
    
    // Build query
    const query = { isActive: true };
    if (category) {
      query.category = category;
    }
    
    // Get count of matching messages
    const count = await EngagementMessage.countDocuments(query);
    
    if (count === 0) {
      logResponse(`${ENDPOINT_SERVICE}.getRandomMessage`, { error: 'No messages found' });
      return null;
    }
    
    // Get a random message
    const random = Math.floor(Math.random() * count);
    const message = await EngagementMessage.findOne(query).skip(random);
    
    logResponse(`${ENDPOINT_SERVICE}.getRandomMessage`, { 
      messageId: message._id,
      category: message.category
    });
    
    return message;
  } catch (error) {
    logError(`${ENDPOINT_SERVICE}.getRandomMessage`, error);
    console.error('Error getting random engagement message:', error);
    return null;
  }
};

// Get a random message from each category
const getRandomMessagesByCategory = async () => {
  try {
    logRequest(`${ENDPOINT_SERVICE}.getRandomMessagesByCategory`, {});
    
    const categories = ['meal_reminder', 'fitness', 'progress', 'hydration', 'evening'];
    const messages = {};
    
    for (const category of categories) {
      messages[category] = await getRandomMessage(category);
    }
    
    logResponse(`${ENDPOINT_SERVICE}.getRandomMessagesByCategory`, { 
      categoriesFound: Object.keys(messages).filter(key => messages[key] !== null)
    });
    
    return messages;
  } catch (error) {
    logError(`${ENDPOINT_SERVICE}.getRandomMessagesByCategory`, error);
    console.error('Error getting random messages by category:', error);
    return {};
  }
};

module.exports = {
  initializeEngagementMessages,
  getRandomMessage,
  getRandomMessagesByCategory
};