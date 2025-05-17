const { createClient } = require('@clickhouse/client');
const OpenAI = require('openai');
const Chat = require('../models/Chat');
const fs = require('fs');
const path = require('path');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');
const { findSimilarMessages, processMessageEmbedding, findRelevantProfileInfo } = require('./embeddingService');
const foodService = require('./foodService');
const User = require('../models/User');
const HealthData = require('../models/HealthData');
const StatsData = require('../models/StatsData');
const ActivityData = require('../models/ActivityData');
const DietaryPreferences = require('../models/DietaryPreferences');
const Notification = require('../models/Notification');
const Profile = require('../models/Profile');
const stepCountService = require('./stepCountService');

// Initialize ClickHouse client
const client = createClient({
  url: 'https://jxp4673roi.westus3.azure.clickhouse.cloud:8443',
  username: 'default',
  password: '53mmu~hQwIZCY',
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create table for chat history if it doesn't exist
const initializeChatTable = async () => {
  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS chat_history (
        id UUID DEFAULT generateUUIDv4(),
        user_message String,
        ai_response String,
        conversation_id Nullable(String),
        timestamp DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY timestamp
    `,
  });
  console.log("Table 'chat_history' initialized.");

  // Check if conversation_id column exists, add it if not
  try {
    await client.query({
      query: `
        ALTER TABLE chat_history
        ADD COLUMN IF NOT EXISTS conversation_id Nullable(String)
      `
    });
    console.log("Ensured conversation_id column exists in chat_history table.");
  } catch (error) {
    console.error("Error adding conversation_id column:", error);
  }
};

// Insert chat record into the database
const insertChatRecord = async (userMessage, aiResponse, conversationId = null) => {
  // Clean any special characters from messages
  const cleanUserMessage = userMessage
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
    .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
    .replace(/^#+\s+/gm, '')         // Remove heading markers
    .replace(/^[-*+]\s+/gm, '')      // Remove bullet points
    .replace(/`([^`]+)`/g, '$1');    // Remove code formatting

  const cleanAiResponse = aiResponse
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
    .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
    .replace(/^#+\s+/gm, '')         // Remove heading markers
    .replace(/^[-*+]\s+/gm, '')      // Remove bullet points
    .replace(/`([^`]+)`/g, '$1');    // Remove code formatting

  await client.insert({
    table: 'chat_history',
    values: [
      {
        user_message: cleanUserMessage,
        ai_response: cleanAiResponse,
        conversation_id: conversationId || null,
        timestamp: new Date().toISOString(),
      },
    ],
    format: 'JSONEachRow',
  });
  console.log('Chat record inserted.');
};

// Fetch chat history
const fetchChatHistory = async (conversationId = null) => {
  let query = 'SELECT * FROM chat_history';

  if (conversationId) {
    query += ` WHERE conversation_id = '${conversationId}'`;
  }

  query += ' ORDER BY timestamp ASC'; // Order chronologically for proper conversation flow

  const rows = await client.query({
    query,
    format: 'JSONEachRow',
  });
  return await rows.json();
};

const ENDPOINT_SERVICE = 'chatService.processMessage';

const chatService = {
  processMessage: async (userId, message, options = {}) => {
    try {
      // Debug: Log service call
      logRequest(ENDPOINT_SERVICE, {
        userId,
        messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        options: {
          conversationId: options.conversationId,
          parentMessageId: options.parentMessageId,
          hasImage: !!options.imageUrl
        }
      });

      // 1. Gather all user data
      const userData = await gatherUserData(userId);

      // 2. Analyze the question type and intent
      const questionAnalysis = await analyzeQuestion(message, userData);

      // 3. Prepare metadata for vector storage
      const messageMetadata = {
        message_type: options.isNotificationQuestion ? 'notification_question' : 'chat',
        source: options.fromNotification ? 'notification' : 'chat',
        has_image: options.imageUrl ? 'true' : 'false',
        parent_message_id: options.parentMessageId || '',
        conversation_type: options.conversationId ? 'thread' : 'new',
        timestamp: new Date().toISOString(),
        question_type: questionAnalysis.type,
        question_intent: questionAnalysis.intent,
        relevant_data_types: questionAnalysis.relevantDataTypes
      };

      // 4. Prepare comprehensive context for vector storage
      const messageContext = {
        user_id: userId,
        conversation_id: options.conversationId || '',
        environment: process.env.NODE_ENV || 'development',
        platform: 'mobile',
        version: process.env.APP_VERSION || '1.0.0',
        user_profile: userData.profile,
        health_data: userData.healthData,
        stats_data: userData.statsData,
        dietary_preferences: userData.dietaryPreferences,
        recent_activities: userData.recentActivities,
        meal_data: userData.mealData
      };

      // 5. Enhanced system prompt with comprehensive context
      const systemPrompt = 'You are a nutrition and fitness assistant with access to comprehensive user data and conversation history.\n\n' +
        'IMPORTANT: When users ask about their profile, ALWAYS include ALL of the following information in your response:\n' +
        '1. Basic Information:\n' +
        '   - Name: ' + userData.profile.basicInfo.name + '\n' +
        '   - Email: ' + userData.profile.basicInfo.email + '\n' +
        '   - Username: ' + userData.profile.basicInfo.username + '\n\n' +
        '2. Physical Metrics:\n' +
        '   - Height: ' + userData.profile.physicalMetrics.height + ' cm\n' +
        '   - Weight: ' + userData.profile.physicalMetrics.weight + ' kg\n' +
        '   - BMI: ' + userData.profile.physicalMetrics.bmi + '\n' +
        '   - Age: ' + userData.profile.physicalMetrics.age + '\n' +
        '   - Gender: ' + userData.profile.physicalMetrics.gender + '\n\n' +
        '3. Fitness Information:\n' +
        '   - Fitness Goal: ' + userData.profile.fitnessInfo.fitness_goal + '\n' +
        '   - Activity Level: ' + userData.profile.fitnessInfo.activity_level + '\n' +
        '   - Dietary Restrictions: ' + userData.profile.fitnessInfo.dietary_restrictions.join(', ') + '\n\n' +
        '4. Profile Timestamps:\n' +
        '   - Created: ' + userData.profile.timestamps.createdAt + '\n' +
        '   - Last Updated: ' + userData.profile.timestamps.updatedAt + '\n\n' +
        'When users ask about their meals, calorie counts, or nutrition data, ALWAYS include the relevant meal data in your response. If a user asks about their calorie count for today or the past week, you MUST provide this information from the meal data provided below.\n\n' +
        '1. Data Integration and Context:\n' +
        '   - Health Data: ' + JSON.stringify(userData.healthData) + '\n' +
        '   - Stats Data: ' + JSON.stringify(userData.statsData) + '\n' +
        '   - Dietary Preferences: ' + JSON.stringify(userData.dietaryPreferences) + '\n' +
        '   - Recent Activities: ' + JSON.stringify(userData.recentActivities) + '\n\n' +
        '2. MEAL DATA (CRITICAL FOR NUTRITION QUESTIONS):\n' +
        '   - Recent Meals (last 7 days): ' + JSON.stringify(userData.mealData.recentMeals) + '\n' +
        '   - Daily Calorie Summary: ' + JSON.stringify(userData.mealData.dailySummary) + '\n' +
        '   - Average Daily Calories: ' + userData.mealData.averageDailyCalories + '\n' +
        '   - Total Calories Last Week: ' + userData.mealData.totalCaloriesLastWeek + '\n\n' +
        '3. Conversation Context:\n' +
        '   - Previous Conversations: ' + JSON.stringify(await fetchChatHistory(options.conversationId)) + '\n' +
        '   - Notification History: ' + JSON.stringify(await fetchNotificationHistory(userId)) + '\n\n' +
        '4. Image Analysis Context:\n' +
        '   ' + (options.imageUrl ? 'An image has been provided for analysis. Please provide detailed nutritional information about the food items visible in the image.' : 'No image provided.');

      // Process image if provided
      let imageAnalysis = null;
      let foodAnalysis = null;
      if (options.imageUrl) {
        try {
          // Get the full path to the image
          const imagePath = path.join(__dirname, '../../', options.imageUrl);
          console.log('Processing image at path:', imagePath);
          
          // Check if file exists
          if (!fs.existsSync(imagePath)) {
            console.error('Image file not found:', imagePath);
            throw new Error('Image file not found');
          }
          
          // Read the image file
          const imageBuffer = fs.readFileSync(imagePath);
          console.log('Image buffer size:', imageBuffer.length);
          
          // Analyze the food using the food service
          console.log('Calling food service to analyze image...');
          foodAnalysis = await foodService.analyzeFood(imageBuffer);
          console.log('Food analysis result:', JSON.stringify(foodAnalysis));
          
          if (foodAnalysis.error) {
            console.log('Food analysis returned an error, falling back to vision API');
            
            // If food analysis failed, fall back to Vision API
            const base64Image = imageBuffer.toString('base64');
            
            // Get image description from OpenAI Vision API
            const visionResponse = await openai.chat.completions.create({
              model: "gpt-4-vision-preview",
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Analyze this food image in detail. Describe what you see, identify the foods, estimate nutritional content, and suggest any health considerations. Be thorough in your analysis."
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: 'data:image/jpeg;base64,' + base64Image
                      }
                    }
                  ]
                }
              ],
              max_tokens: 500
            });
            
            imageAnalysis = visionResponse.choices[0].message.content;
          } else {
            // Format the food analysis result into a readable message
            const foodItems = foodAnalysis.foodItems;
            let analysisText = "I've analyzed your food image and identified the following items:\n\n";
            
            foodItems.forEach(item => {
              analysisText += item.name + ': ' + item.calories + ' calories per 100g. ';
              analysisText += 'Contains ' + item.protein + 'g protein, ' + item.carbs + 'g carbs, ' + item.fat + 'g fat, and ' + item.fiber + 'g fiber. ';
              analysisText += 'This food is generally considered ' + (item.isHealthy ? 'healthy' : 'less healthy') + '.\n\n';
            });
            
            analysisText += 'Total estimated calories: ' + foodAnalysis.totalCalories;
            
            imageAnalysis = analysisText;
          }
        } catch (error) {
          console.error('Error processing image:', error);
          imageAnalysis = "I apologize, but I encountered an error while analyzing the image. Please try again with a different image or describe the food items you'd like me to analyze.";
        }
      }

      // Create messages array for chat completions API
      const messages = [
        {
          role: "system",
          content: systemPrompt
        }
      ];

      // Add image analysis to the conversation if available
      if (imageAnalysis) {
        messages.push({
          role: "system",
          content: 'I\'ve analyzed the image the user shared. Here\'s what I can see: ' + imageAnalysis
        });
      }

      // Add user message
      messages.push({
        role: "user",
        content: message
      });

      // Get AI response
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      });

      const aiResponse = completion.choices[0].message.content;

      // Return the response with image analysis if available
      return {
        message: aiResponse,
        imageAnalysis: imageAnalysis,
        foodAnalysis: foodAnalysis
      };

    } catch (error) {
      console.error('Error in processMessage:', error);
      logError(ENDPOINT_SERVICE, error);
      throw error;
    }
  }
};

// Helper function to gather all user data
async function gatherUserData(userId) {
  try {
    // Fetch user profile and profile data separately
    const userProfile = await User.findById(userId);
    const profile = await Profile.findOne({ userId });

    // Fetch health data
    const healthData = await HealthData.findOne({ userId });

    // Fetch stats data
    const statsData = await StatsData.findOne({ userId });

    // Fetch recent activities
    const recentActivities = await ActivityData.find({ userId })
      .sort({ timestamp: -1 })
      .limit(10);

    // Fetch dietary preferences
    const dietaryPreferences = await DietaryPreferences.findOne({ userId });

    // Fetch recent meals (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const Meal = require('../models/Meal');
    const recentMeals = await Meal.find({
      userId,
      date: { $gte: sevenDaysAgo }
    }).sort({ date: -1 }).limit(10);

    // Calculate daily calorie averages
    const mealsByDate = {};
    recentMeals.forEach(meal => {
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

    // Calculate average daily calories
    const totalDays = Object.keys(caloriesByDate).length;
    const totalCalories = Object.values(caloriesByDate).reduce((sum, cal) => sum + cal, 0);
    const averageDailyCalories = totalDays > 0 ? Math.round(totalCalories / totalDays) : 0;

    // Create a daily summary
    const dailySummary = Object.keys(mealsByDate).map(date => ({
      date,
      totalCalories: caloriesByDate[date],
      mealCount: mealsByDate[date].length,
      meals: mealsByDate[date].map(meal => ({
        id: meal._id.toString(),
        mealType: meal.mealType,
        totalCalories: meal.totalCalories,
        foodItems: meal.foodItems.map(item => ({
          name: item.name,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          isHealthy: item.isHealthy
        }))
      }))
    })).sort((a, b) => new Date(b.date) - new Date(a.date));

    // Create a comprehensive profile object
    const comprehensiveProfile = {
      basicInfo: {
        name: userProfile?.name || '',
        email: userProfile?.email || '',
        username: userProfile?.username || ''
      },
      physicalMetrics: {
        height: profile?.height || null,
        weight: profile?.weight || null,
        bmi: profile?.bmi || null,
        age: profile?.age || null,
        gender: profile?.gender || null
      },
      fitnessInfo: {
        fitness_goal: profile?.fitness_goal || null,
        activity_level: profile?.activity_level || null,
        dietary_restrictions: profile?.dietary_restrictions || []
      },
      timestamps: {
        createdAt: profile?.createdAt || null,
        updatedAt: profile?.updatedAt || null
      }
    };

    // Get step count data with proper error handling
    let stepCountData = {
      current: 0,
      trend: [],
      average: 0,
      total: 0,
      days: 0,
      goalAchievement: 'Not tracked',
      trend: 'Not enough data',
      recommendations: 'No data available'
    };

    try {
      // Get today's step count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentStepCount = await stepCountService.getStepCount(userId, today);
      
      // Get step count trend
      const stepTrend = await stepCountService.getStepCountTrend(userId);
      
      // Get average steps
      const averageSteps = await stepCountService.getAverageStepCount(
        userId,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        new Date()
      );

      // Calculate total steps
      const totalSteps = stepTrend.reduce((sum, record) => sum + (record.count || 0), 0);

      // Update step count data
      stepCountData = {
        current: currentStepCount.count || 0,
        trend: stepTrend,
        average: averageSteps || 0,
        total: totalSteps,
        days: stepTrend.length,
        goalAchievement: (currentStepCount.count || 0) >= (profile?.dailyStepGoal || 10000) ? 'Achieved' : 'Not achieved',
        trend: stepTrend.length > 1 ? 
          ((stepTrend[stepTrend.length - 1]?.count || 0) > (stepTrend[0]?.count || 0) ? 'Increasing' : 'Decreasing') : 
          'Not enough data',
        recommendations: getStepCountRecommendations(
          currentStepCount.count || 0,
          averageSteps || 0,
          profile?.dailyStepGoal || 10000
        )
      };
    } catch (error) {
      console.error('Error gathering step count data:', error);
      // Keep default values if there's an error
    }

    // Add step count data to user data
    const userData = {
      profile: comprehensiveProfile,
      healthData,
      statsData,
      recentActivities,
      dietaryPreferences,
      mealData: {
        recentMeals: recentMeals.map(meal => ({
          id: meal._id.toString(),
          date: meal.date,
          mealType: meal.mealType,
          totalCalories: meal.totalCalories,
          foodItems: meal.foodItems.map(item => ({
            name: item.name,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            isHealthy: item.isHealthy
          }))
        })),
        dailySummary,
        averageDailyCalories,
        totalCaloriesLastWeek: totalCalories
      },
      stepCount: stepCountData
    };

    return userData;
  } catch (error) {
    console.error('Error gathering user data:', error);
    throw error;
  }
}

// Helper function to analyze question type and intent
async function analyzeQuestion(message, userData) {
  try {
    // First, check for common meal-related queries using regex patterns
    const mealPatterns = [
      /recent\s+(\d+)?\s*meals/i,
      /last\s+(\d+)?\s*meals/i,
      /what\s+(did|have)\s+I\s+(eat|had|consumed)/i,
      /calorie\s+count/i,
      /calories?\s+(of|for|in|from)/i,
      /average\s+calorie/i,
      /total\s+calories/i,
      /meal\s+history/i,
      /nutrition\s+summary/i,
      /food\s+log/i,
      /diet\s+summary/i,
      /what\s+I\s+(ate|consumed|had)/i,
      /today'?s\s+calories?/i,
      /yesterday'?s\s+calories?/i,
      /calories?\s+yesterday/i,
      /calories?\s+today/i,
      /calories?\s+count/i,
      /calories?\s+intake/i,
      /calories?\s+consumed/i,
      /calories?\s+eaten/i,
      /calories?\s+burned/i,
      /calories?\s+last\s+(\d+)?\s*days?/i,
      /calories?\s+week/i,
      /week'?s?\s+calories?/i,
      /improve\s+nutrition/i,
      /improve\s+diet/i,
      /improve\s+eating/i,
      /improve\s+calories?/i,
      /improve\s+meal/i
    ];

    const isMealQuery = mealPatterns.some(pattern => pattern.test(message));

    if (isMealQuery) {
      // For meal-related queries, return a specialized analysis
      return {
        type: 'nutrition',
        intent: 'get_meal_data',
        relevantDataTypes: ['meal_history', 'calorie_data', 'nutrition_data'],
        isNotificationRelated: false,
        requiresUserData: true,
        isMealRelated: true
      };
    }

    // For other queries, use a simpler approach without JSON parsing
    // Directly analyze the message content
    const messageLower = message.toLowerCase();

    // Determine question type
    let questionType = 'general';
    if (messageLower.includes('meal') || messageLower.includes('food') ||
        messageLower.includes('eat') || messageLower.includes('calorie') ||
        messageLower.includes('nutrition')) {
      questionType = 'nutrition';
    } else if (messageLower.includes('exercise') || messageLower.includes('workout') ||
               messageLower.includes('activity') || messageLower.includes('steps')) {
      questionType = 'fitness';
    } else if (messageLower.includes('weight') || messageLower.includes('height') ||
               messageLower.includes('bmi') || messageLower.includes('profile')) {
      questionType = 'profile';
    }

    // Determine intent
    let intent = 'get_information';
    if (messageLower.includes('how') || messageLower.includes('what') ||
        messageLower.includes('why') || messageLower.includes('when')) {
      intent = 'get_information';
    } else if (messageLower.includes('add') || messageLower.includes('create') ||
               messageLower.includes('log') || messageLower.includes('record')) {
      intent = 'add_data';
    } else if (messageLower.includes('update') || messageLower.includes('change') ||
               messageLower.includes('modify')) {
      intent = 'update_data';
    }

    // Determine relevant data types
    const relevantDataTypes = [];
    if (messageLower.includes('meal') || messageLower.includes('food') ||
        messageLower.includes('eat') || messageLower.includes('calorie') ||
        messageLower.includes('nutrition')) {
      relevantDataTypes.push('meal_data');
    }
    if (messageLower.includes('exercise') || messageLower.includes('workout') ||
        messageLower.includes('activity') || messageLower.includes('steps')) {
      relevantDataTypes.push('activity_data');
    }
    if (messageLower.includes('weight') || messageLower.includes('height') ||
        messageLower.includes('bmi') || messageLower.includes('profile')) {
      relevantDataTypes.push('profile_data');
    }
    if (relevantDataTypes.length === 0) {
      relevantDataTypes.push('conversation_history');
    }

    // Determine if notification related
    const isNotificationRelated = messageLower.includes('notification') ||
                                 messageLower.includes('alert') ||
                                 messageLower.includes('reminder');

    // Determine if requires user data
    const requiresUserData = messageLower.includes('my') ||
                            messageLower.includes('me') ||
                            messageLower.includes('i') ||
                            messageLower.includes('mine');

    // Determine if meal related
    const isMealRelated = messageLower.includes('meal') ||
                         messageLower.includes('food') ||
                         messageLower.includes('eat') ||
                         messageLower.includes('calorie') ||
                         messageLower.includes('nutrition');

    // Create analysis object
    const analysis = {
      questionType,
      intent,
      relevantDataTypes,
      isNotificationRelated,
      requiresUserData,
      isMealRelated
    };

    return {
      type: analysis.questionType || 'general',
      intent: analysis.intent || 'unknown',
      relevantDataTypes: analysis.relevantDataTypes || ['conversation_history'],
      isNotificationRelated: analysis.isNotificationRelated || false,
      requiresUserData: analysis.requiresUserData || false,
      isMealRelated: analysis.isMealRelated || false
    };
  } catch (error) {
    console.error('Error analyzing question:', error);
    return {
      type: 'general',
      intent: 'unknown',
      relevantDataTypes: ['conversation_history'],
      isNotificationRelated: false,
      requiresUserData: false,
      isMealRelated: message.toLowerCase().includes('meal') ||
                    message.toLowerCase().includes('food') ||
                    message.toLowerCase().includes('eat') ||
                    message.toLowerCase().includes('calorie')
    };
  }
}

// Helper function to fetch notification history
async function fetchNotificationHistory(userId) {
  try {
    const notifications = await Notification.find({ userId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    return notifications.map(notification => ({
      question: notification.question,
      answer: notification.answer,
      timestamp: notification.timestamp,
      type: notification.type
    }));
  } catch (error) {
    console.error('Error fetching notification history:', error);
    return [];
  }
}

// Add this function to get profile context
const getProfileContext = async (userId, query) => {
  try {
    const profileInfo = await findRelevantProfileInfo(userId, query);
    if (profileInfo && profileInfo.length > 0) {
      const profile = profileInfo[0];
      return 'User Profile Information:\n' +
        '- Height: ' + profile.height + ' cm\n' +
        '- Weight: ' + profile.weight + ' kg\n' +
        '- BMI: ' + profile.bmi + '\n' +
        '- Age: ' + profile.age + '\n' +
        '- Gender: ' + profile.gender + '\n' +
        '- Fitness Goal: ' + profile.fitness_goal + '\n' +
        '- Activity Level: ' + profile.activity_level + '\n' +
        '- Dietary Restrictions: ' + profile.dietary_restrictions.join(', ') + '\n';
    }
    return '';
  } catch (error) {
    console.error('Error getting profile context:', error);
    return '';
  }
};

// Modify your existing chat function to include profile context
const processChatMessage = async (userId, message) => {
  try {
    // Get profile context
    const profileContext = await getProfileContext(userId, message);
    
    // Add profile context to the system message
    const systemMessage = 'You are a helpful AI nutrition and fitness assistant. Use the following user profile information to provide personalized responses:\n\n' +
      profileContext +
      'Please provide accurate and helpful responses based on the user\'s profile and their questions.';

    // ... rest of your existing chat processing code ...
    // Make sure to include the systemMessage in your OpenAI API call

  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
};

// Add this helper function
function getStepCountRecommendations(currentSteps, averageSteps, dailyGoal) {
  const recommendations = [];
  
  if (currentSteps < dailyGoal) {
    const remainingSteps = dailyGoal - currentSteps;
    recommendations.push('You need ' + remainingSteps + ' more steps to reach your daily goal.');
    
    if (remainingSteps > 1000) {
      recommendations.push('Consider taking a longer walk or doing some light exercise.');
    }
  } else {
    recommendations.push('Great job! You\'ve reached your daily step goal.');
  }

  if (averageSteps < dailyGoal) {
    recommendations.push('Your average daily steps are below your goal. Try to be more active throughout the day.');
  } else {
    recommendations.push('You\'re maintaining a good average step count. Keep up the good work!');
  }

  return recommendations.join(' ');
}

module.exports = {
  initializeChatTable,
  insertChatRecord,
  fetchChatHistory,
  chatService,
};
