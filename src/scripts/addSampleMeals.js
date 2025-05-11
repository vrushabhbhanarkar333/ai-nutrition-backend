require('dotenv').config();
const mongoose = require('mongoose');
const Meal = require('../models/Meal');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Function to create sample meals for a user
async function createSampleMeals(userId) {
  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User with ID ${userId} not found`);
      return;
    }

    console.log(`Creating sample meals for user: ${user.username} (${userId})`);

    // Get current date
    const today = new Date();
    
    // Create sample meals for the last 7 days
    const meals = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Breakfast
      meals.push({
        userId,
        foodItems: [
          {
            name: 'Oatmeal',
            calories: 150,
            servingSize: '1 cup',
            mealType: 'breakfast',
            isHealthy: true,
            protein: 5,
            carbs: 27,
            fat: 3,
            fiber: 4
          },
          {
            name: 'Banana',
            calories: 105,
            servingSize: '1 medium',
            mealType: 'breakfast',
            isHealthy: true,
            protein: 1.3,
            carbs: 27,
            fat: 0.4,
            fiber: 3.1
          }
        ],
        totalCalories: 255,
        date,
        mealType: 'breakfast',
        totalNutrition: {
          protein: 6.3,
          carbs: 54,
          fat: 3.4,
          fiber: 7.1
        }
      });
      
      // Lunch
      meals.push({
        userId,
        foodItems: [
          {
            name: 'Chicken Salad',
            calories: 350,
            servingSize: '1 bowl',
            mealType: 'lunch',
            isHealthy: true,
            protein: 25,
            carbs: 15,
            fat: 20,
            fiber: 5
          },
          {
            name: 'Whole Grain Bread',
            calories: 80,
            servingSize: '1 slice',
            mealType: 'lunch',
            isHealthy: true,
            protein: 3,
            carbs: 15,
            fat: 1,
            fiber: 2
          }
        ],
        totalCalories: 430,
        date,
        mealType: 'lunch',
        totalNutrition: {
          protein: 28,
          carbs: 30,
          fat: 21,
          fiber: 7
        }
      });
      
      // Dinner
      meals.push({
        userId,
        foodItems: [
          {
            name: 'Grilled Salmon',
            calories: 367,
            servingSize: '6 oz',
            mealType: 'dinner',
            isHealthy: true,
            protein: 34,
            carbs: 0,
            fat: 22,
            fiber: 0
          },
          {
            name: 'Brown Rice',
            calories: 216,
            servingSize: '1 cup',
            mealType: 'dinner',
            isHealthy: true,
            protein: 5,
            carbs: 45,
            fat: 1.8,
            fiber: 3.5
          },
          {
            name: 'Steamed Broccoli',
            calories: 55,
            servingSize: '1 cup',
            mealType: 'dinner',
            isHealthy: true,
            protein: 3.7,
            carbs: 11.2,
            fat: 0.6,
            fiber: 5.1
          }
        ],
        totalCalories: 638,
        date,
        mealType: 'dinner',
        totalNutrition: {
          protein: 42.7,
          carbs: 56.2,
          fat: 24.4,
          fiber: 8.6
        }
      });
      
      // Snack (only on even days)
      if (i % 2 === 0) {
        meals.push({
          userId,
          foodItems: [
            {
              name: 'Greek Yogurt',
              calories: 100,
              servingSize: '6 oz',
              mealType: 'snack',
              isHealthy: true,
              protein: 17,
              carbs: 6,
              fat: 0,
              fiber: 0
            },
            {
              name: 'Blueberries',
              calories: 84,
              servingSize: '1 cup',
              mealType: 'snack',
              isHealthy: true,
              protein: 1.1,
              carbs: 21.4,
              fat: 0.5,
              fiber: 3.6
            }
          ],
          totalCalories: 184,
          date,
          mealType: 'snack',
          totalNutrition: {
            protein: 18.1,
            carbs: 27.4,
            fat: 0.5,
            fiber: 3.6
          }
        });
      }
    }
    
    // Insert all meals
    await Meal.insertMany(meals);
    
    console.log(`Successfully added ${meals.length} sample meals for user ${userId}`);
  } catch (error) {
    console.error('Error creating sample meals:', error);
  }
}

// Get user ID from command line argument
const userId = process.argv[2];

if (!userId) {
  console.error('Please provide a user ID as a command line argument');
  process.exit(1);
}

// Create sample meals and then disconnect
createSampleMeals(userId)
  .then(() => {
    console.log('Sample meal creation completed');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
  });
