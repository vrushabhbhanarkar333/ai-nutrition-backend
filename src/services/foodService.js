const axios = require('axios');
const apiConfig = require('../config/api');

// Food items database with meal types and health status
const foodItems = [
  { name: 'pizza', mealType: 'dinner', isHealthy: false, calories: 285 },
  { name: 'salad', mealType: 'lunch', isHealthy: true, calories: 150 },
  { name: 'burger', mealType: 'lunch', isHealthy: false, calories: 354 },
  { name: 'pasta', mealType: 'dinner', isHealthy: true, calories: 220 },
  { name: 'rice', mealType: 'dinner', isHealthy: true, calories: 130 },
  { name: 'chicken', mealType: 'dinner', isHealthy: true, calories: 165 },
  { name: 'fish', mealType: 'dinner', isHealthy: true, calories: 200 },
  { name: 'vegetables', mealType: 'snack', isHealthy: true, calories: 50 },
  { name: 'sandwich', mealType: 'lunch', isHealthy: true, calories: 300 },
  { name: 'fruits', mealType: 'breakfast', isHealthy: true, calories: 80 },
  { name: 'cereal', mealType: 'breakfast', isHealthy: true, calories: 120 },
  { name: 'soup', mealType: 'lunch', isHealthy: true, calories: 150 }
];

const foodService = {
  analyzeFood: async (imageBuffer) => {
    try {
      console.log('Starting food analysis...');
      
      // Convert image buffer to base64
      const base64Image = imageBuffer.toString('base64');
      console.log('Image converted to base64, length:', base64Image.length);

      // Call Gemini API for image recognition
      console.log('Calling Gemini API for image recognition...');
      const geminiResponse = await axios.post(
        `${apiConfig.gemini.endpoint}?key=${apiConfig.gemini.apiKey}`,
        {
          contents: [{
            parts: [{
              text: "Identify the food items in this image. Return only the names of the food items in a comma-separated list, nothing else."
            }, {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }]
          }]
        }
      );

      console.log('Gemini API response:', geminiResponse.data);

      if (!geminiResponse.data.candidates || !geminiResponse.data.candidates[0]) {
        throw new Error('No food items detected in the image');
      }

      // Extract food items from Gemini response
      const foodItemsText = geminiResponse.data.candidates[0].content.parts[0].text;
      const foodItems = foodItemsText.split(',').map(item => item.trim());
      console.log('Identified food items:', foodItems);

      if (foodItems.length === 0) {
        throw new Error('No food items could be identified in the image');
      }

      // Get nutritional information for each food item
      console.log('Getting nutritional information from CalorieNinja...');
      const nutritionalInfo = await Promise.all(
        foodItems.map(async (foodItem) => {
          try {
            console.log(`Fetching nutrition info for: ${foodItem}`);
            const calorieResponse = await axios.get(
              `${apiConfig.calorieNinja.endpoint}?query=${encodeURIComponent(foodItem)}`,
              {
                headers: {
                  'X-Api-Key': apiConfig.calorieNinja.apiKey
                }
              }
            );

            console.log(`Nutrition info for ${foodItem}:`, calorieResponse.data);

            if (!calorieResponse.data.items || calorieResponse.data.items.length === 0) {
              console.log(`No nutrition data found for ${foodItem}`);
              return {
                name: foodItem,
                calories: 0,
                servingSize: "100g",
                mealType: determineMealType(foodItem),
                isHealthy: false,
                error: "Nutritional information not available"
              };
            }

            const itemInfo = calorieResponse.data.items[0];
            const result = {
              name: itemInfo.name,
              calories: itemInfo.calories || 0,
              servingSize: `${itemInfo.serving_size_g || 100}g`,
              mealType: determineMealType(itemInfo.name),
              isHealthy: determineHealthiness(itemInfo),
              protein: itemInfo.protein_g || 0,
              carbs: itemInfo.carbohydrates_total_g || 0,
              fat: itemInfo.fat_total_g || 0,
              fiber: itemInfo.fiber_g || 0
            };
            
            console.log(`Processed nutrition info for ${foodItem}:`, result);
            return result;
          } catch (error) {
            console.error(`Error getting nutrition info for ${foodItem}:`, error);
            return {
              name: foodItem,
              calories: 0,
              servingSize: "100g",
              mealType: determineMealType(foodItem),
              isHealthy: false,
              error: "Failed to get nutritional information"
            };
          }
        })
      );

      const totalCalories = nutritionalInfo.reduce((sum, item) => sum + item.calories, 0);
      console.log('Total calories:', totalCalories);

      const result = {
        foodItems: nutritionalInfo,
        totalCalories: totalCalories,
        timestamp: new Date().toISOString()
      };

      console.log('Final analysis result:', result);
      return result;

    } catch (error) {
      console.error('Error in foodService:', error);
      throw new Error(error.message || 'Failed to analyze food image');
    }
  }
};

// Helper functions
function determineMealType(foodName) {
  const breakfastFoods = ['cereal', 'toast', 'pancakes', 'waffles', 'eggs', 'yogurt', 'fruit', 'coffee', 'tea', 'milk'];
  const lunchFoods = ['sandwich', 'salad', 'soup', 'pasta', 'rice', 'wrap', 'burrito', 'taco'];
  const dinnerFoods = ['pizza', 'burger', 'steak', 'chicken', 'fish', 'pasta', 'curry', 'stew', 'roast'];
  const snackFoods = ['chips', 'cookies', 'nuts', 'fruit', 'vegetables', 'candy', 'chocolate', 'popcorn'];

  const lowerFoodName = foodName.toLowerCase();
  
  if (breakfastFoods.some(food => lowerFoodName.includes(food))) return 'breakfast';
  if (lunchFoods.some(food => lowerFoodName.includes(food))) return 'lunch';
  if (dinnerFoods.some(food => lowerFoodName.includes(food))) return 'dinner';
  if (snackFoods.some(food => lowerFoodName.includes(food))) return 'snack';
  
  return 'meal';
}

function determineHealthiness(foodInfo) {
  // Skip healthiness check if we don't have nutritional data
  if (!foodInfo.calories || !foodInfo.serving_size_g) return false;

  const caloriesPer100g = (foodInfo.calories / foodInfo.serving_size_g) * 100;
  
  // Consider food healthy if:
  // 1. Less than 150 calories per 100g
  // 2. Has protein
  // 3. Has fiber
  // 4. Not too high in fat
  return caloriesPer100g < 150 && 
         (foodInfo.protein_g || 0) > 0 && 
         (foodInfo.fiber_g || 0) > 0 &&
         (foodInfo.fat_total_g || 0) < 10;
}

module.exports = foodService; 