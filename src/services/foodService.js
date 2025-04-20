const axios = require('axios');
const apiConfig = require('../config/api');

// const foodService = {
//   analyzeFood: async (imageBuffer) => {
//     try {
//       console.log('Starting food analysis...');
      
//       // Convert image buffer to base64
//       const base64Image = imageBuffer.toString('base64');
//       console.log('Image converted to base64, length:', base64Image.length);

//       // Call Gemini API for image recognition
//       console.log('Calling Gemini API for image recognition...');
//       const geminiResponse = await axios.post(
//         `${apiConfig.gemini.endpoint}?key=${apiConfig.gemini.apiKey}`,
//         {
//           contents: [{
//             parts: [{
//               text: "Identify the food items in this image. Return only the names of the food items in a comma-separated list, nothing else."
//             }, {
//               inline_data: {
//                 mime_type: "image/jpeg",
//                 data: base64Image
//               }
//             }]
//           }]
//         }
//       );

//       console.log('Gemini API response:', geminiResponse.data);

//       if (!geminiResponse.data.candidates || !geminiResponse.data.candidates[0]) {
//         throw new Error('No food items detected in the image');
//       }

//       // Extract food items from Gemini response
//       const foodItemsText = geminiResponse.data.candidates[0].content.parts[0].text;
//       const foodItems = foodItemsText.split(',').map(item => item.trim());
//       console.log('Identified food items:', foodItems);

//       if (foodItems.length === 0) {
//         throw new Error('No food items could be identified in the image');
//       }

//       // Get nutritional information for each food item
//       console.log('Getting nutritional information from CalorieNinja...');
//       const nutritionalInfo = await Promise.all(
//         foodItems.map(async (foodItem) => {
//           try {
//             console.log(`Fetching nutrition info for: ${foodItem}`);
//             const calorieResponse = await axios.get(
//               `${apiConfig.calorieNinja.endpoint}?query=${encodeURIComponent(foodItem)}`,
//               {
//                 headers: {
//                   'X-Api-Key': apiConfig.calorieNinja.apiKey
//                 }
//               }
//             );

//             console.log(`Nutrition info for ${foodItem}:`, calorieResponse.data);

//             if (!calorieResponse.data.items || calorieResponse.data.items.length === 0) {
//               console.log(`No nutrition data found for ${foodItem}`);
//               return {
//                 name: foodItem,
//                 calories: 0,
//                 servingSize: "100g",
//                 mealType: determineMealType(foodItem),
//                 isHealthy: false,
//                 error: "Nutritional information not available"
//               };
//             }

//             const itemInfo = calorieResponse.data.items[0];
//             const result = {
//               name: itemInfo.name,
//               calories: itemInfo.calories || 0,
//               servingSize: `${itemInfo.serving_size_g || 100}g`,
//               mealType: determineMealType(itemInfo.name),
//               isHealthy: determineHealthiness(itemInfo),
//               protein: itemInfo.protein_g || 0,
//               carbs: itemInfo.carbohydrates_total_g || 0,
//               fat: itemInfo.fat_total_g || 0,
//               fiber: itemInfo.fiber_g || 0
//             };
            
//             console.log(`Processed nutrition info for ${foodItem}:`, result);
//             return result;
//           } catch (error) {
//             console.error(`Error getting nutrition info for ${foodItem}:`, error);
//             return {
//               name: foodItem,
//               calories: 0,
//               servingSize: "100g",
//               mealType: determineMealType(foodItem),
//               isHealthy: false,
//               error: "Failed to get nutritional information"
//             };
//           }
//         })
//       );

//       const totalCalories = nutritionalInfo.reduce((sum, item) => sum + item.calories, 0);
//       console.log('Total calories:', totalCalories);

//       const result = {
//         foodItems: nutritionalInfo,
//         totalCalories: totalCalories,
//         timestamp: new Date().toISOString()
//       };

//       console.log('Final analysis result:', result);
//       return result;

//     } catch (error) {
//       console.error('Error in foodService:', error);
//       throw new Error(error.message || 'Failed to analyze food image');
//     }
//   }
// };

const foodService = {
  analyzeFood: async (imageBuffer) => {
    try {
      console.log('Starting food analysis...');
      
      // Convert image buffer to base64
      const base64Image = imageBuffer.toString('base64');
      console.log('Image converted to base64, length:', base64Image.length);

      // First check if the image contains food
      console.log('Validating if image contains food...');
      const validationResponse = await axios.post(
        `${apiConfig.gemini.endpoint}?key=${apiConfig.gemini.apiKey}`,
        {
          contents: [{
            parts: [{
              text: "Does this image contain food items? Answer only 'yes' or 'no'."
            }, {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }]
          }]
        }
      );

      const validationText = validationResponse.data.candidates?.[0]?.content?.parts?.[0]?.text.toLowerCase() || '';
      console.log('Food validation response:', validationText);

      if (!validationText.includes('yes')) {
        console.log('No food detected in the image');
        return {
          error: true,
          message: "No food items detected in this image. Please upload an image containing food for nutritional analysis.",
          foodItems: [],
          totalCalories: 0,
          timestamp: new Date().toISOString()
        };
      }

      // Call Gemini API with enhanced prompt for comprehensive nutrition analysis
      console.log('Calling Gemini API for food recognition and nutrition analysis...');
      const promptText = `
      Task: Analyze the food items in this image and provide detailed nutritional information.

      1. First identify all food items visible in the image.
      2. For each identified food item, provide the following nutritional information for a standard serving size of 100g:
         - Calories
         - Protein (g)
         - Carbohydrates (g)
         - Fat (g)
         - Fiber (g)
      3. Determine if each food item would generally be considered healthy based on its nutritional profile.
      
      Format your response as a valid JSON object with this exact structure:
      {
        "foodItems": [
          {
            "name": "item name",
            "calories": 123,
            "servingSize": "100g",
            "isHealthy": true|false,
            "protein": 12,
            "carbs": 23,
            "fat": 5,
            "fiber": 3
          }
        ]
      }

      Include only this JSON in your response, with no additional text, explanation, or markdown formatting.
      If you're uncertain about any nutritional values, provide your best estimate based on similar foods.
      `;

      const geminiResponse = await axios.post(
        `${apiConfig.gemini.endpoint}?key=${apiConfig.gemini.apiKey}`,
        {
          contents: [{
            parts: [{
              text: promptText
            }, {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }]
          }]
        }
      );

      console.log('Gemini API response received');

      if (!geminiResponse.data.candidates || !geminiResponse.data.candidates[0]) {
        throw new Error('Failed to analyze the image content');
      }

      // Extract the JSON response from Gemini
      const responseText = geminiResponse.data.candidates[0].content.parts[0].text;
      
      // Clean up the response text to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      
      let nutritionData;
      try {
        nutritionData = JSON.parse(cleanedResponse);
        console.log('Parsed nutrition data:', nutritionData);
      } catch (error) {
        console.error('Error parsing JSON response:', error);
        throw new Error('Failed to parse nutritional information from Gemini response');
      }

      if (!nutritionData.foodItems || nutritionData.foodItems.length === 0) {
        return {
          error: true,
          message: "Could not identify any specific food items in the image. Please try with a clearer image of food.",
          foodItems: [],
          totalCalories: 0,
          timestamp: new Date().toISOString()
        };
      }

      // Calculate total calories
      const totalCalories = nutritionData.foodItems.reduce((sum, item) => sum + item.calories, 0);
      console.log('Total calories:', totalCalories);

      const result = {
        error: false,
        foodItems: nutritionData.foodItems,
        totalCalories: totalCalories,
        timestamp: new Date().toISOString()
      };

      console.log('Final analysis result:', result);
      return result;

    } catch (error) {
      console.error('Error in foodService:', error);
      return {
        error: true,
        message: error.message || 'Failed to analyze food image',
        foodItems: [],
        totalCalories: 0,
        timestamp: new Date().toISOString()
      };
    }
  }
};

// This utility function is kept for compatibility but with simplified implementation
// since meal type is no longer needed
function determineHealthiness(nutritionalInfo) {
  // Simple heuristic for healthiness
  const caloriesPerHundredGrams = nutritionalInfo.calories;
  const proteinGrams = nutritionalInfo.protein_g || 0;
  const fiberGrams = nutritionalInfo.fiber_g || 0;
  const sugarGrams = nutritionalInfo.sugar_g || 0;
  const fatGrams = nutritionalInfo.fat_total_g || 0;
  const saturatedFatGrams = nutritionalInfo.fat_saturated_g || 0;
  
  // Higher protein and fiber are good indicators
  const proteinFiberScore = (proteinGrams * 2) + (fiberGrams * 3);
  
  // Higher sugar, fat (especially saturated fat) tend to be less healthy
  const negativeScore = (sugarGrams * 1.5) + (fatGrams) + (saturatedFatGrams * 2);
  
  // Calculate overall health score
  const healthScore = proteinFiberScore - negativeScore;
  
  // Consider low-calorie foods with decent nutrition as healthy
  if (caloriesPerHundredGrams < 150 && healthScore > -2) {
    return true;
  }
  
  // Consider high protein foods with moderate calories as healthy
  if (proteinGrams > 15 && caloriesPerHundredGrams < 250) {
    return true;
  }
  
  // Consider foods with good fiber and moderate calories as healthy
  if (fiberGrams > 5 && caloriesPerHundredGrams < 200) {
    return true;
  }
  
  // High-calorie, high-sugar, high-fat foods are generally less healthy
  if (caloriesPerHundredGrams > 300 && sugarGrams > 10 && fatGrams > 15) {
    return false;
  }
  
  // Use health score for remaining cases
  return healthScore > 0;
}

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
  
  // Default to snack if no specific meal type is identified
  return 'snack';
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