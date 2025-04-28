const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const foodService = {
  analyzeFood: async (imageBuffer) => {
    try {
      console.log('Starting food analysis...');

      // Convert image buffer to base64
      const base64Image = imageBuffer.toString('base64');
      console.log('Image converted to base64, length:', base64Image.length);

      // Use OpenAI API for food recognition and nutrition analysis
      console.log('Calling OpenAI API for food recognition and nutrition analysis...');
      const promptText = `Analyze the food items in this image and provide detailed nutritional information.\n\n1. Identify all food items visible in the image.\n2. For each identified food item, provide the following nutritional information for a standard serving size of 100g:\n   - Calories\n   - Protein (g)\n   - Carbohydrates (g)\n   - Fat (g)\n   - Fiber (g)\n3. Determine if each food item would generally be considered healthy based on its nutritional profile.\n\nFormat your response as a valid JSON object with this exact structure:\n{\n  \"foodItems\": [\n    {\n      \"name\": \"item name\",\n      \"calories\": 123,\n      \"servingSize\": \"100g\",\n      \"isHealthy\": true|false,\n      \"protein\": 12,\n      \"carbs\": 23,\n      \"fat\": 5,\n      \"fiber\": 3\n    }\n  ]\n}\n\nInclude only this JSON in your response.`;

      const response = await openai.completions.create({
        model: 'text-davinci-003',
        prompt: promptText,
        max_tokens: 1000,
      });

      const responseText = response.choices[0].text.trim();
      console.log('OpenAI API response:', responseText);

      const nutritionData = JSON.parse(responseText);

      if (!nutritionData.foodItems || nutritionData.foodItems.length === 0) {
        return {
          error: true,
          message: "Could not identify any specific food items in the image. Please try with a clearer image of food.",
          foodItems: [],
          totalCalories: 0,
          timestamp: new Date().toISOString(),
        };
      }

      const totalCalories = nutritionData.foodItems.reduce((sum, item) => sum + item.calories, 0);
      console.log('Total calories:', totalCalories);

      return {
        error: false,
        foodItems: nutritionData.foodItems,
        totalCalories,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error in foodService:', error);
      return {
        error: true,
        message: error.message || 'Failed to analyze food image',
        foodItems: [],
        totalCalories: 0,
        timestamp: new Date().toISOString(),
      };
    }
  },
};

module.exports = foodService;