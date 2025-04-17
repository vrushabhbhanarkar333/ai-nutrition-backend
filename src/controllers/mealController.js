const Meal = require('../models/Meal');
const User = require('../models/User');

const mealController = {
  // Add a new meal
  addMeal: async (req, res) => {
    try {
      const { foodItems, mealType } = req.body;
      const userId = req.user._id;

      // Calculate total calories
      const totalCalories = foodItems.reduce((sum, item) => sum + item.calories, 0);

      // Get user data for the response
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const meal = new Meal({
        userId,
        foodItems,
        totalCalories,
        mealType,
        date: new Date()
      });

      await meal.save();
      console.log(`Meal added for user ${userId}: ${totalCalories} calories, type: ${mealType}`);

      // Return the created meal along with user info
      res.status(201).json({
        success: true,
        data: {
          meal: {
            id: meal._id,
            foodItems: meal.foodItems,
            totalCalories: meal.totalCalories,
            mealType: meal.mealType,
            date: meal.date
          },
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          }
        }
      });
    } catch (error) {
      console.error('Error adding meal:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get recent meals (last 7 days)
  getRecentMeals: async (req, res) => {
    try {
      const userId = req.user._id;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get user data for the response
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const meals = await Meal.find({
        userId,
        date: { $gte: sevenDaysAgo }
      }).sort({ date: -1 });

      // Calculate total calories for recent meals
      const totalRecentCalories = meals.reduce((sum, meal) => sum + meal.totalCalories, 0);

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          },
          totalRecentCalories,
          count: meals.length,
          meals: meals.map(meal => ({
            id: meal._id,
            foodItems: meal.foodItems,
            totalCalories: meal.totalCalories,
            mealType: meal.mealType,
            date: meal.date
          }))
        }
      });
    } catch (error) {
      console.error('Error getting recent meals:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get daily calorie count
  getDailyCalories: async (req, res) => {
    try {
      const userId = req.user._id;
      const dateString = req.query.date; // Optional date parameter (YYYY-MM-DD)
      
      // Get user data for the response
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Use provided date or default to today
      let targetDate;
      if (dateString) {
        targetDate = new Date(dateString);
      } else {
        targetDate = new Date();
      }
      
      // Set to start of day
      targetDate.setHours(0, 0, 0, 0);
      
      // Set to end of day
      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);

      const meals = await Meal.find({
        userId,
        date: { $gte: targetDate, $lte: endDate }
      }).sort({ date: 1 });

      // Calculate daily totals
      const totalCalories = meals.reduce((sum, meal) => sum + meal.totalCalories, 0);
      
      // Group meals by type
      const mealsByType = {
        breakfast: meals.filter(meal => meal.mealType === 'breakfast'),
        lunch: meals.filter(meal => meal.mealType === 'lunch'),
        dinner: meals.filter(meal => meal.mealType === 'dinner'),
        snack: meals.filter(meal => meal.mealType === 'snack')
      };

      // Calculate calories by meal type
      const caloriesByType = {
        breakfast: mealsByType.breakfast.reduce((sum, meal) => sum + meal.totalCalories, 0),
        lunch: mealsByType.lunch.reduce((sum, meal) => sum + meal.totalCalories, 0),
        dinner: mealsByType.dinner.reduce((sum, meal) => sum + meal.totalCalories, 0),
        snack: mealsByType.snack.reduce((sum, meal) => sum + meal.totalCalories, 0)
      };

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            dailyStepGoal: user.dailyStepGoal
          },
          date: targetDate.toISOString().split('T')[0],
          totalCalories,
          caloriesByType,
          mealCount: meals.length,
          breakdown: meals.map(meal => ({
            id: meal._id,
            mealType: meal.mealType,
            calories: meal.totalCalories,
            time: meal.date,
            foodItems: meal.foodItems.map(item => ({
              name: item.name,
              calories: item.calories,
              isHealthy: item.isHealthy
            }))
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
      
      if (!date) {
        return res.status(400).json({
          success: false,
          error: 'Date parameter is required (format: YYYY-MM-DD)'
        });
      }
      
      // Get user data for the response
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
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
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          },
          date,
          totalCalories,
          mealCount: meals.length,
          meals: meals.map(meal => ({
            id: meal._id,
            mealType: meal.mealType,
            totalCalories: meal.totalCalories,
            time: meal.date,
            foodItems: meal.foodItems
          }))
        }
      });
    } catch (error) {
      console.error('Error getting meal history:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get calories by date range (weekly overview)
  getCaloriesByDateRange: async (req, res) => {
    try {
      const userId = req.user._id;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Both startDate and endDate parameters are required (format: YYYY-MM-DD)'
        });
      }
      
      // Get user data for the response
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const meals = await Meal.find({
        userId,
        date: { $gte: start, $lte: end }
      });

      // Group meals by date
      const mealsByDate = {};
      meals.forEach(meal => {
        const dateKey = meal.date.toISOString().split('T')[0];
        if (!mealsByDate[dateKey]) {
          mealsByDate[dateKey] = [];
        }
        mealsByDate[dateKey].push(meal);
      });

      // Calculate calories by date
      const caloriesByDate = {};
      Object.keys(mealsByDate).forEach(date => {
        caloriesByDate[date] = mealsByDate[date].reduce(
          (sum, meal) => sum + meal.totalCalories, 0
        );
      });

      // Create a daily summary
      const dailySummary = Object.keys(mealsByDate).map(date => ({
        date,
        totalCalories: caloriesByDate[date],
        mealCount: mealsByDate[date].length
      })).sort((a, b) => new Date(a.date) - new Date(b.date));

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          },
          startDate,
          endDate,
          totalCalories: Object.values(caloriesByDate).reduce((sum, cal) => sum + cal, 0),
          dailySummary
        }
      });
    } catch (error) {
      console.error('Error getting calories by date range:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = mealController; 