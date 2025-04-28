const OpenAI = require('openai');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary with credentials from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dfhvvyzk2',
  api_key: process.env.CLOUDINARY_API_KEY || '654937611297122',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'Es7BSt9VzeqCOrqOxEmz4VtSKWE'
});

// Upload image to Cloudinary
const uploadImage = async (fileBuffer, folder = 'uploads') => {
  try {
    // Convert buffer to base64 string for Cloudinary upload
    const base64String = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64String, {
      folder: folder,
      resource_type: 'image'
    });
    
    return {
      public_id: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error(`Failed to upload image to Cloudinary: ${error.message}`);
  }
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const foodService = {
  analyzeFood: async (imageBuffer) => {
    try {
      console.log('Starting food analysis...');

      // Upload image to Cloudinary
      console.log('Uploading image to Cloudinary...');
      const cloudinaryResult = await uploadImage(imageBuffer, 'food-analysis');
      console.log('Image uploaded to Cloudinary:', cloudinaryResult.url);

      // Convert image buffer to base64 for OpenAI
      const base64Image = imageBuffer.toString('base64');
      console.log('Image converted to base64, length:', base64Image.length);

      // Use OpenAI API for food recognition and nutrition analysis
      console.log('Calling OpenAI API for food recognition and nutrition analysis...');
      
      // Try with GPT-4o first, fall back to GPT-3.5-turbo if needed
      let model = 'gpt-4o';
      let response;
      
      try {
        response = await openai.chat.completions.create({
          model: model,
          messages: [
          {
            role: 'system',
            content: 'You are a nutrition analysis assistant. Analyze food images and provide detailed nutritional information in JSON format.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze the food items in this image and provide detailed nutritional information.

1. Identify all food items visible in the image.
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

Include only this JSON in your response.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: cloudinaryResult.url
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });
      } catch (modelError) {
        console.log(`Error with model ${model}, falling back to gpt-3.5-turbo:`, modelError.message);
        model = 'gpt-3.5-turbo-0125';
        
        response = await openai.chat.completions.create({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a nutrition analysis assistant. Analyze food images and provide detailed nutritional information in JSON format.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze the food items in this image and provide detailed nutritional information.

1. Identify all food items visible in the image.
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

Include only this JSON in your response.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: cloudinaryResult.url
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
          response_format: { type: "json_object" }
        });
      }

      console.log(`Successfully used model: ${model}`);
      const responseText = response.choices[0].message.content.trim();
      console.log('OpenAI API response:', responseText);

      // Safely parse JSON with error handling
      let nutritionData;
      try {
        nutritionData = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        console.error('Raw response:', responseText);
        
        // Create a default structure if parsing fails
        nutritionData = { foodItems: [] };
      }

      if (!nutritionData.foodItems || nutritionData.foodItems.length === 0) {
        return {
          error: true,
          message: "Could not identify any specific food items in the image. Please try with a clearer image of food.",
          foodItems: [],
          totalCalories: 0,
          imageUrl: cloudinaryResult.url,
          imagePublicId: cloudinaryResult.public_id,
          timestamp: new Date().toISOString(),
        };
      }

      const totalCalories = nutritionData.foodItems.reduce((sum, item) => sum + item.calories, 0);
      console.log('Total calories:', totalCalories);

      return {
        error: false,
        foodItems: nutritionData.foodItems,
        totalCalories,
        imageUrl: cloudinaryResult.url,
        imagePublicId: cloudinaryResult.public_id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error in foodService:', error);
      
      // Log detailed error information
      if (error.status) {
        console.error(`Status: ${error.status}, Message: ${error.message}`);
      }
      if (error.code) {
        console.error(`Error code: ${error.code}`);
      }
      if (error.type) {
        console.error(`Error type: ${error.type}`);
      }
      if (error.stack) {
        console.error(`Stack trace: ${error.stack}`);
      }
      
      // Provide more detailed error information
      let errorMessage = 'Failed to analyze food image';
      
      if (error.status) {
        errorMessage = `${error.status} ${error.message}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Check if cloudinaryResult exists (in case the error occurred before upload)
      const imageData = {};
      if (typeof cloudinaryResult !== 'undefined' && cloudinaryResult) {
        imageData.imageUrl = cloudinaryResult.url;
        imageData.imagePublicId = cloudinaryResult.public_id;
      }
      
      return {
        error: true,
        message: errorMessage,
        foodItems: [],
        totalCalories: 0,
        ...imageData,
        timestamp: new Date().toISOString(),
      };
    }
  },
};

module.exports = foodService;