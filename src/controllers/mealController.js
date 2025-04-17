const Meal = require('../models/Meal');

const mealController = {
  // Add a new meal
  addMeal: async (req, res) => {
    console.log('[MEAL_CONTROLLER] Add meal request received');
    console.log('[MEAL_CONTROLLER] User ID:', req.user._id);
    console.log('[MEAL_CONTROLLER] Meal data:', JSON.stringify(req.body));
    try {
      const { foodItems, mealType } = req.body;
      const userId = req.user._id;
      
      // Validate input
      if (!foodItems || !Array.isArray(foodItems) || foodItems.length === 0) {
        console.log('[MEAL_CONTROLLER] Add meal failed: Invalid food items');
        return res.status(400).json({
          success: false,
          message: 'Food items are required and must be a non-empty array'
        });
      }
      
      if (!mealType) {
        console.log('[MEAL_CONTROLLER] Add meal failed: Missing meal type');
        return res.status(400).json({
          success: false,
          message: 'Meal type is required'
        });
      }

      // Calculate total calories
      const totalCalories = foodItems.reduce((sum, item) => sum + item.calories, 0);

      const meal = new Meal({
        userId,
        foodItems,
        totalCalories,
        mealType,
        date: new Date()
      });

      await meal.save();
      console.log('[MEAL_CONTROLLER] Meal saved successfully with ID:', meal._id);
      console.log('[MEAL_CONTROLLER] Total calories:', totalCalories);

      res.status(201).json({
        success: true,
        data: meal
      });
    } catch (error) {
      console.error('[MEAL_CONTROLLER] Error adding meal:', error.message);
      console.error('[MEAL_CONTROLLER] Error stack:', error.stack);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }
  },

  // Get recent meals (last 7 days)
  getRecentMeals: async (req, res) => {
    console.log('[MEAL_CONTROLLER] Get recent meals request received');
    console.log('[MEAL_CONTROLLER] User ID:', req.user._id);
    try {
      const userId = req.user._id;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      console.log('[MEAL_CONTROLLER] Fetching meals since:', sevenDaysAgo.toISOString());

      const meals = await Meal.find({
        userId,
        date: { $gte: sevenDaysAgo }
      }).sort({ date: -1 });

      console.log('[MEAL_CONTROLLER] Retrieved', meals.length, 'recent meals');
      res.json({
        success: true,
        data: meals
      });
    } catch (error) {
      console.error('[MEAL_CONTROLLER] Error getting recent meals:', error.message);
      console.error('[MEAL_CONTROLLER] Error stack:', error.stack);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }
  },

  // Get daily calorie count
  getDailyCalories: async (req, res) => {
    try {
      const userId = req.user._id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const meals = await Meal.find({
        userId,
        date: { $gte: today }
      });

      const totalCalories = meals.reduce((sum, meal) => sum + meal.totalCalories, 0);

      res.json({
        success: true,
        data: {
          totalCalories,
          meals: meals.length,
          breakdown: meals.map(meal => ({
            mealType: meal.mealType,
            calories: meal.totalCalories,
            time: meal.date
          }))
        }
      });
    } catch (error) {
      console.error('Error getting daily calories:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get meal history for a specific date
  getMealHistory: async (req, res) => {
    try {
      const userId = req.user._id;
      const { date } = req.query;
      
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const meals = await Meal.find({
        userId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1 });

      const totalCalories = meals.reduce((sum, meal) => sum + meal.totalCalories, 0);

      res.json({
        success: true,
        data: {
          totalCalories,
          meals,
          date: date
        }
      });
    } catch (error) {
      console.error('Error getting meal history:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = mealController; 