const Meal = require('../models/Meal');
const User = require('../models/User');
const Profile = require('../models/Profile');

const mealController = {
  // Add a new meal
  addMeal: async (req, res) => {
    try {
      const { foodItems, mealType } = req.body;
      const userId = req.user._id;

      // Validate required fields
      if (!foodItems || !Array.isArray(foodItems) || foodItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Food items are required and must be an array'
        });
      }

      if (!mealType) {
        return res.status(400).json({
          success: false,
          error: 'Meal type is required'
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
      console.log(`New meal added for user ${userId}, calories: ${totalCalories}`);

      res.status(201).json({
        success: true,
        data: meal
      });
    } catch (error) {
      console.error('Error adding meal:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get recent meals (last 7 days) with user profile info
  getRecentMeals: async (req, res) => {
    try {
      const userId = req.user._id;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get user profile information
      const user = await User.findById(userId);
      const profile = await Profile.findOne({ userId });

      // Get recent meals
      const meals = await Meal.find({
        userId,
        date: { $gte: sevenDaysAgo }
      }).sort({ date: -1 });

      // Group meals by date
      const mealsByDate = meals.reduce((acc, meal) => {
        const dateStr = meal.date.toISOString().split('T')[0];
        if (!acc[dateStr]) {
          acc[dateStr] = {
            date: dateStr,
            meals: [],
            totalCalories: 0
          };
        }
        acc[dateStr].meals.push(meal);
        acc[dateStr].totalCalories += meal.totalCalories;
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          },
          profile: profile ? {
            height: profile.height,
            weight: profile.weight,
            bmi: profile.bmi,
            fitnessGoals: profile.fitnessGoals
          } : null,
          mealHistory: Object.values(mealsByDate)
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

  // Get daily calorie count with detailed breakdown
  getDailyCalories: async (req, res) => {
    try {
      const userId = req.user._id;
      const dateParam = req.query.date;
      
      // Use provided date or default to today
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get user information
      const user = await User.findById(userId);
      const profile = await Profile.findOne({ userId });

      // Get meals for the day
      const meals = await Meal.find({
        userId,
        date: { $gte: startOfDay, $lte: endOfDay }
      }).sort({ date: 1 });

      // Calculate totals and breakdowns
      const totalCalories = meals.reduce((sum, meal) => sum + meal.totalCalories, 0);
      
      // Group by meal type
      const mealTypeBreakdown = meals.reduce((acc, meal) => {
        if (!acc[meal.mealType]) {
          acc[meal.mealType] = {
            mealType: meal.mealType,
            calories: 0,
            count: 0
          };
        }
        acc[meal.mealType].calories += meal.totalCalories;
        acc[meal.mealType].count += 1;
        return acc;
      }, {});

      // Food item breakdown
      const foodItemsConsumed = [];
      meals.forEach(meal => {
        meal.foodItems.forEach(item => {
          foodItemsConsumed.push({
            name: item.name,
            calories: item.calories,
            mealType: meal.mealType,
            time: meal.date,
            isHealthy: item.isHealthy
          });
        });
      });

      // Get daily calorie target from profile if available
      let calorieTarget = 2000; // Default
      if (profile) {
        // Calculate based on weight, height, activity level
        const weight = profile.weight;
        const heightInMeters = profile.height / 100;
        
        // Basic BMR calculation using Harris-Benedict formula
        let bmr;
        if (user.gender === 'female') {
          bmr = 655 + (9.6 * weight) + (1.8 * profile.height) - (4.7 * 25); // Assumed age 25
        } else {
          bmr = 66 + (13.7 * weight) + (5 * profile.height) - (6.8 * 25); // Assumed age 25
        }
        
        // Adjust based on activity level
        const activityMultipliers = {
          sedentary: 1.2,
          light: 1.375,
          moderate: 1.55,
          active: 1.725,
          very_active: 1.9
        };
        
        const activityMultiplier = activityMultipliers[profile.activityLevel] || 1.55;
        calorieTarget = Math.round(bmr * activityMultiplier);
        
        // Adjust based on fitness goals
        if (profile.fitnessGoals === 'weight_loss') {
          calorieTarget -= 500; // Deficit for weight loss
        } else if (profile.fitnessGoals === 'muscle_gain') {
          calorieTarget += 300; // Surplus for muscle gain
        }
      }

      res.json({
        success: true,
        data: {
          date: targetDate.toISOString().split('T')[0],
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          },
          totalCalories,
          calorieTarget,
          calorieRemaining: calorieTarget - totalCalories,
          percentageConsumed: Math.round((totalCalories / calorieTarget) * 100),
          mealsCount: meals.length,
          mealTypeBreakdown: Object.values(mealTypeBreakdown),
          foodItemsConsumed,
          meals
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

  // Get meal history for a specific date range
  getMealHistory: async (req, res) => {
    try {
      const userId = req.user._id;
      const { startDate, endDate } = req.query;
      
      // Default to last 30 days if no date range specified
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);
      
      const start = startDate ? new Date(startDate) : new Date();
      if (!startDate) {
        start.setDate(start.getDate() - 30); // Default to 30 days ago
      }
      start.setHours(0, 0, 0, 0);

      // Get user information
      const user = await User.findById(userId);

      // Get meals in the date range
      const meals = await Meal.find({
        userId,
        date: { $gte: start, $lte: end }
      }).sort({ date: 1 });

      // Group meals by date
      const mealsByDate = meals.reduce((acc, meal) => {
        const dateStr = meal.date.toISOString().split('T')[0];
        if (!acc[dateStr]) {
          acc[dateStr] = {
            date: dateStr,
            totalCalories: 0,
            meals: []
          };
        }
        acc[dateStr].meals.push(meal);
        acc[dateStr].totalCalories += meal.totalCalories;
        return acc;
      }, {});

      // Convert to array and add daily statistics
      const dailyStats = Object.values(mealsByDate).map(day => {
        // Count food items by meal type
        const mealTypeCounts = day.meals.reduce((acc, meal) => {
          if (!acc[meal.mealType]) {
            acc[meal.mealType] = 0;
          }
          acc[meal.mealType] += meal.foodItems.length;
          return acc;
        }, {});

        return {
          ...day,
          mealTypeStats: mealTypeCounts
        };
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          },
          dateRange: {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
          },
          totalDays: dailyStats.length,
          dailyStats
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