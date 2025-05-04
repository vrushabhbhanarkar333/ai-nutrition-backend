require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const EngagementMessage = require('../models/EngagementMessage');

const seedEngagementMessages = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');
    
    // Check if we already have messages
    const count = await EngagementMessage.countDocuments();
    if (count > 0) {
      console.log(`Found ${count} existing engagement messages.`);
      const deleteAll = process.argv.includes('--force');
      
      if (deleteAll) {
        console.log('Deleting all existing messages...');
        await EngagementMessage.deleteMany({});
        console.log('All existing messages deleted.');
      } else {
        console.log('Use --force flag to delete existing messages and reseed.');
        return;
      }
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
      { 
        category: 'meal_reminder', 
        message: "Hungry? Let me suggest a meal that aligns with your nutrition goals" 
      },
      { 
        category: 'meal_reminder', 
        message: "Dinner planning time! Need some healthy ideas that match your preferences?" 
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
      { 
        category: 'fitness', 
        message: "Time for a quick energy boost! How about a 2-minute desk workout?" 
      },
      { 
        category: 'fitness', 
        message: "Your body needs movement after sitting. Want a quick exercise suggestion?" 
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
      { 
        category: 'progress', 
        message: "Small wins add up! What's one healthy choice you made today?" 
      },
      { 
        category: 'progress', 
        message: "Looking at your trends, you're making progress! Want to see your stats?" 
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
      { 
        category: 'hydration', 
        message: "Water break reminder! Staying hydrated helps with energy and focus" 
      },
      { 
        category: 'hydration', 
        message: "Did you know proper hydration can reduce cravings? Time for water!" 
      },
      
      // Evening Wrap-ups
      { 
        category: 'evening', 
        message: "How did the day go? Let's review your meals and activity 📋" 
      },
      { 
        category: 'evening', 
        message: "Feeling cravings at night? I've got some healthy snack hacks 😋" 
      },
      { 
        category: 'evening', 
        message: "Wind-down time! Want a quick relaxation technique to try tonight?" 
      },
      { 
        category: 'evening', 
        message: "Let's plan tomorrow's meals to set you up for success" 
      }
    ];
    
    // Insert all default messages
    await EngagementMessage.insertMany(defaultMessages);
    
    console.log(`Successfully seeded ${defaultMessages.length} engagement messages`);
    
    // Count by category
    const categories = ['meal_reminder', 'fitness', 'progress', 'hydration', 'evening'];
    for (const category of categories) {
      const count = await EngagementMessage.countDocuments({ category });
      console.log(`${category}: ${count} messages`);
    }
  } catch (error) {
    console.error('Error seeding engagement messages:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

seedEngagementMessages();