const foodService = require('../services/foodService');
const Meal = require('../models/Meal');
const DailyCalorie = require('../models/DailyCalorie');

const foodController = {
  analyzeFood: async (req, res) => {
    try {
      console.log('Received file:', req.file);
      
      if (!req.file) {
        console.log('No file provided in request');
        return res.status(400).json({ 
          success: false,
          error: 'No image file provided' 
        });
      }

      // Check if the file is an image
      if (!req.file.mimetype.startsWith('image/')) {
        console.log('Invalid file type:', req.file.mimetype);
        return res.status(400).json({ 
          success: false,
          error: 'File must be an image' 
        });
      }

      console.log('Processing image:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      // Analyze the food using the service
      const result = await foodService.analyzeFood(req.file.buffer);
      
      console.log('Analysis result:', result);

      // If there was an error in the analysis but not a server error
      if (result.error) {
        res.json({
          success: false,
          error: result.message,
          data: result
        });
      } else {
        res.json({
          success: true,
          data: result
        });
      }
    } catch (error) {
      console.error('Error in foodController:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error analyzing food image',
        error: error.message 
      });
    }
  },

  // Add analyzed food to daily calories and recent meals
  addAnalyzedFood: async (req, res) => {
    try {
      const { foodItems, totalCalories, mealType } = req.body;
      const userId = req.user._id;

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

      // Validate meal type
      const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
      const validatedMealType = validMealTypes.includes(mealType) ? mealType : 'snack';
      
      // Validate food items meal types and ensure nutrition values are included
      const validatedFoodItems = foodItems.map(item => {
        // Make a copy of the item to avoid modifying the original
        const validatedItem = { 
          ...item,
          // Ensure nutrition values are included with defaults if missing
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fat: item.fat || 0,
          fiber: item.fiber || 0
        };
        
        // Ensure mealType is valid
        if (!validMealTypes.includes(validatedItem.mealType)) {
          validatedItem.mealType = validatedMealType;
        }
        
        // Log the item to verify nutrition values are included
        console.log('Validated food item:', JSON.stringify(validatedItem));
        
        return validatedItem;
      });

      // Create a new meal entry with explicit nutrition values
      const processedFoodItems = validatedFoodItems.map(item => ({
        name: item.name,
        calories: item.calories,
        servingSize: item.servingSize || '100g',
        mealType: item.mealType || validatedMealType,
        isHealthy: item.isHealthy || false,
        protein: Number(item.protein),
        carbs: Number(item.carbs),
        fat: Number(item.fat),
        fiber: Number(item.fiber)
      }));
      
      const meal = new Meal({
        userId,
        foodItems: processedFoodItems,
        totalCalories: totalCalories || processedFoodItems.reduce((sum, item) => sum + item.calories, 0),
        mealType: validatedMealType,
        date: new Date()
      });

      //meal.totalNutrition = totalNutrition;
      await meal.save();
      console.log(`Meal added for user ${userId}: ${meal.totalCalories} calories, type: ${validatedMealType}`);

      // Update daily calorie count
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find or create daily calorie entry
      let dailyCalorie = await DailyCalorie.findOne({
        userId,
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      if (!dailyCalorie) {
        dailyCalorie = new DailyCalorie({
          userId,
          date: today,
          totalCalories: meal.totalCalories,
          lastUpdated: new Date()
        });
      } else {
        dailyCalorie.totalCalories += meal.totalCalories;
        dailyCalorie.lastUpdated = new Date();
      }

      await dailyCalorie.save();
      console.log(`Daily calorie updated for user ${userId}: ${dailyCalorie.totalCalories} calories`);

      // Calculate total nutrition values directly from the processed food items
      const totalNutrition = processedFoodItems.reduce((totals, item) => {
        return {
          protein: totals.protein + (Number(item.protein) || 0),
          carbs: totals.carbs + (Number(item.carbs) || 0),
          fat: totals.fat + (Number(item.fat) || 0),
          fiber: totals.fiber + (Number(item.fiber) || 0)
        };
      }, { protein: 0, carbs: 0, fat: 0, fiber: 0 });
      
      // Log the meal and nutrition values for debugging
      console.log('Saved meal:', JSON.stringify(meal));
      console.log('Total nutrition calculated:', JSON.stringify(totalNutrition));
      
      // Prepare the response with the exact structure requested
      const response = {
        success: true,
        data: {
          meal: {
            id: meal._id,
            foodItems: processedFoodItems.map(item => ({
              name: item.name,
              calories: item.calories,
              servingSize: item.servingSize,
              mealType: item.mealType,
              isHealthy: item.isHealthy,
              protein: Number(item.protein) || 0,
              carbs: Number(item.carbs) || 0,
              fat: Number(item.fat) || 0,
              fiber: Number(item.fiber) || 0
            })),
            totalCalories: meal.totalCalories,
            totalNutrition: {
              protein: parseFloat(totalNutrition.protein.toFixed(1)),
              carbs: parseFloat(totalNutrition.carbs.toFixed(1)),
              fat: parseFloat(totalNutrition.fat.toFixed(1)),
              fiber: parseFloat(totalNutrition.fiber.toFixed(1))
            },
            mealType: meal.mealType,
            date: meal.date
          },
          dailyCalories: dailyCalorie.totalCalories
        }
      };
      
      // Log the final response for debugging
      console.log('Response:', JSON.stringify(response));
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Error adding analyzed food:', error);
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
      
      // Use provided date or default to today
      let targetDate;
      if (dateString) {
        targetDate = new Date(dateString);
      } else {
        targetDate = new Date();
      }
      
      // Set to start of day
      targetDate.setHours(0, 0, 0, 0);
      
      // Find daily calorie entry
      const dailyCalorie = await DailyCalorie.findOne({
        userId,
        date: {
          $gte: targetDate,
          $lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      const totalCalories = dailyCalorie ? dailyCalorie.totalCalories : 0;

      res.json({
        success: true,
        data: {
          date: targetDate.toISOString().split('T')[0],
          totalCalories,
          lastUpdated: dailyCalorie ? dailyCalorie.lastUpdated : null
        }
      });
    } catch (error) {
      console.error('Error getting daily calories:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = foodController; 