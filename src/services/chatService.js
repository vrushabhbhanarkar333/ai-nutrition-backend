const { createClient } = require('@clickhouse/client');
const OpenAI = require('openai');
const Chat = require('../models/Chat');
const fs = require('fs');
const path = require('path');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');
const { findSimilarMessages, processMessageEmbedding } = require('./embeddingService');
const foodService = require('./foodService');
const User = require('../models/User');
const HealthData = require('../models/HealthData');
const StatsData = require('../models/StatsData');
const ActivityData = require('../models/ActivityData');
const DietaryPreferences = require('../models/DietaryPreferences');
const Notification = require('../models/Notification');

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
      const systemPrompt = `You are a nutrition and fitness assistant with access to comprehensive user data and conversation history.

IMPORTANT: When users ask about their meals, calorie counts, or nutrition data, ALWAYS include the relevant meal data in your response. If a user asks about their calorie count for today or the past week, you MUST provide this information from the meal data provided below.

1. Data Integration and Context:
   - User Profile: ${JSON.stringify(userData.profile)}
   - Health Data: ${JSON.stringify(userData.healthData)}
   - Stats Data: ${JSON.stringify(userData.statsData)}
   - Dietary Preferences: ${JSON.stringify(userData.dietaryPreferences)}
   - Recent Activities: ${JSON.stringify(userData.recentActivities)}

2. MEAL DATA (CRITICAL FOR NUTRITION QUESTIONS):
   - Recent Meals (last 7 days): ${JSON.stringify(userData.mealData.recentMeals)}
   - Daily Calorie Summary: ${JSON.stringify(userData.mealData.dailySummary)}
   - Average Daily Calories: ${userData.mealData.averageDailyCalories}
   - Total Calories Last Week: ${userData.mealData.totalCaloriesLastWeek}

3. Conversation Context:
   - Previous Conversations: ${JSON.stringify(await fetchChatHistory(options.conversationId))}
   - Notification History: ${JSON.stringify(await fetchNotificationHistory(userId))}

4. Question Analysis:
   - Type: ${questionAnalysis.type}
   - Intent: ${questionAnalysis.intent}
   - Relevant Data Types: ${questionAnalysis.relevantDataTypes.join(', ')}
   - Is Meal Related: ${questionAnalysis.isMealRelated}
   - Context: ${questionAnalysis.context || 'general'}

5. MEAL DATA INSTRUCTIONS (CRITICAL):
   - When asked about meals or calories, ALWAYS include specific meal data in your response
   - For "recent meals" questions, list the most recent meals with dates, types, and calories
   - For "calorie count" questions, provide exact numbers from the meal data
   - For "today's calories" or "yesterday's calories", use the most recent day in the data
   - For "last 7 days calories", list the daily calorie totals from the dailySummary
   - ALWAYS mention the average daily calorie count when discussing calorie trends
   - When asked about nutrition improvements, compare current intake to dietary goals

6. Response Guidelines:
   - Combine user data with general nutrition/fitness knowledge
   - Reference specific metrics from user's history
   - Connect current question with previous interactions
   - Consider notification context if applicable
   - Maintain conversation flow and context
   - Provide actionable, personalized advice
   - Use both specific user data and general knowledge
   - Keep responses concise but comprehensive

7. Data Integration Strategy:
   - Primary Data Sources:
     * User's personal metrics and history
     * Previous conversation context
     * Notification questions and responses
     * Recent activities and progress
     * Meal data and calorie information
   - Secondary Knowledge:
     * General nutrition principles
     * Fitness best practices
     * Health guidelines
     * Scientific research

8. Context Awareness:
   - Track conversation threads
   - Reference previous notification questions
   - Consider user's progress over time
   - Maintain awareness of user's goals
   - Connect related topics across conversations

9. Response Structure:
   - Acknowledge user's specific situation
   - Reference relevant historical data
   - Provide personalized advice
   - Include actionable next steps
   - Connect with previous interactions
   - Maintain conversation continuity

Remember to:
1. ALWAYS include meal data when responding to nutrition questions
2. Reference specific data points when relevant
3. Connect current questions with past interactions
4. Balance personal data with general knowledge
5. Maintain conversation flow and context
6. Provide practical, actionable advice`;

      // Initialize messages array with system message
      const messages = [
        {
          role: "system",
          content: systemPrompt
        }
      ];

      // 6. Add relevant historical data based on question analysis
      if (questionAnalysis.relevantDataTypes.includes('conversation_history')) {
        const history = await fetchChatHistory(options.conversationId);
        if (history.length > 0) {
          messages.push({
            role: "system",
            content: "Relevant conversation history:"
          });
          history.forEach(msg => {
            messages.push({
              role: msg.isAI ? "assistant" : "user",
              content: msg.message
            });
          });
        }
      }

      // 7. Add notification history if relevant
      if (questionAnalysis.isNotificationRelated) {
        const notificationHistory = await fetchNotificationHistory(userId);
        if (notificationHistory.length > 0) {
          messages.push({
            role: "system",
            content: "Relevant notification history:"
          });
          notificationHistory.forEach(notification => {
            messages.push({
              role: "system",
              content: `Notification: ${notification.question}\nResponse: ${notification.answer}`
            });
          });
        }
      }

      // 8. Add similar messages from vector search
      const similarMessages = await findSimilarMessages(userId, message, 3);
      if (similarMessages.length > 0) {
        messages.push({
          role: "system",
          content: "Similar previous interactions:"
        });
        similarMessages.forEach(m => {
          messages.push({
            role: m.is_ai ? "assistant" : "user",
            content: m.message
          });
        });
      }

      // 9. Add the current user message with context
      messages.push({
        role: "user",
        content: message
      });

      // 10. Get AI response with comprehensive context
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      });

      // Process and clean the response
      let cleanedResponse = response.choices[0].message.content.trim();
      cleanedResponse = cleanedResponse
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/^#+\s+/gm, '')
        .replace(/^[-*+]\s+/gm, '• ')
        .replace(/`([^`]+)`/g, '$1');

      // Store the interaction in vector database
      await processMessageEmbedding(
        userId,
        options.conversationId,
        options.messageId || Date.now().toString(),
        message,
        false,
        messageMetadata,
        messageContext
      );

      await processMessageEmbedding(
        userId,
        options.conversationId,
        (Date.now() + 1).toString(),
        cleanedResponse,
        true,
        {
          ...messageMetadata,
          response_to_message_id: options.messageId || '',
          response_type: 'ai_assistant',
          response_quality: 'high'
        },
        {
          ...messageContext,
          response_context: JSON.stringify({
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            max_tokens: 500
          })
        }
      );

      return {
        message: cleanedResponse,
        questionAnalysis,
        relevantData: {
          userProfile: userData.profile,
          healthData: userData.healthData,
          statsData: userData.statsData,
          mealData: userData.mealData
        }
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
    // Fetch user profile
    const userProfile = await User.findById(userId);

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

    return {
      profile: userProfile,
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
      }
    };
  } catch (error) {
    console.error('Error gathering user data:', error);
    return {
      profile: null,
      healthData: null,
      statsData: null,
      recentActivities: [],
      dietaryPreferences: null,
      mealData: {
        recentMeals: [],
        dailySummary: [],
        averageDailyCalories: 0,
        totalCaloriesLastWeek: 0
      }
    };
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

module.exports = {
  initializeChatTable,
  insertChatRecord,
  fetchChatHistory,
  chatService,
};
