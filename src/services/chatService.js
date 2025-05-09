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
        calorie_intake: userData.calorieIntake,
        recent_meals: userData.recentMeals
      };

      // 5. Enhanced system prompt with comprehensive context
      const systemPrompt = `You are a nutrition and fitness assistant with access to comprehensive user data and conversation history. Your responses should be:

1. Data Integration and Context:
   - User Profile: ${JSON.stringify(userData.profile)}
   - Health Data: ${JSON.stringify(userData.healthData)}
   - Stats Data: ${JSON.stringify(userData.statsData)}
   - Dietary Preferences: ${JSON.stringify(userData.dietaryPreferences)}
   - Recent Activities: ${JSON.stringify(userData.recentActivities)}
   - Calorie Intake: ${JSON.stringify(userData.calorieIntake)}
   - Recent Meals: ${JSON.stringify(userData.recentMeals)}
   - Previous Conversations: ${JSON.stringify(await fetchChatHistory(options.conversationId))}
   - Notification History: ${JSON.stringify(await fetchNotificationHistory(userId))}

2. Question Analysis:
   - Type: ${questionAnalysis.type}
   - Intent: ${questionAnalysis.intent}
   - Relevant Data Types: ${questionAnalysis.relevantDataTypes.join(', ')}
   - Context: ${questionAnalysis.context || 'general'}

3. Response Guidelines:
   - Combine user data with general nutrition/fitness knowledge
   - Reference specific metrics from user's history
   - Connect current question with previous interactions
   - Consider notification context if applicable
   - Maintain conversation flow and context
   - Provide actionable, personalized advice
   - Use both specific user data and general knowledge
   - Keep responses concise but comprehensive

4. Data Integration Strategy:
   - Primary Data Sources:
     * User's personal metrics and history
     * Previous conversation context
     * Notification questions and responses
     * Recent activities and progress
   - Secondary Knowledge:
     * General nutrition principles
     * Fitness best practices
     * Health guidelines
     * Scientific research

5. Context Awareness:
   - Track conversation threads
   - Reference previous notification questions
   - Consider user's progress over time
   - Maintain awareness of user's goals
   - Connect related topics across conversations

6. Response Structure:
   - Acknowledge user's specific situation
   - Reference relevant historical data
   - Provide personalized advice
   - Include actionable next steps
   - Connect with previous interactions
   - Maintain conversation continuity

Remember to:
1. Always consider the user's complete context
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
          calorieIntake: userData.calorieIntake,
          recentMeals: userData.recentMeals
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

    // Fetch daily calorie data
    const DailyCalorie = require('../models/DailyCalorie');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dailyCalories = await DailyCalorie.find({
      userId,
      date: { $gte: today, $lt: tomorrow }
    }).sort({ date: -1 }).limit(1);
    
    // Fetch recent meals
    const Meal = require('../models/Meal');
    const recentMeals = await Meal.find({ userId })
      .sort({ date: -1 })
      .limit(5);

    return {
      profile: userProfile,
      healthData,
      statsData,
      recentActivities,
      dietaryPreferences,
      calorieIntake: dailyCalories.length > 0 ? dailyCalories[0] : null,
      recentMeals
    };
  } catch (error) {
    console.error('Error gathering user data:', error);
    return {
      profile: null,
      healthData: null,
      statsData: null,
      recentActivities: [],
      dietaryPreferences: null,
      calorieIntake: null,
      recentMeals: []
    };
  }
}

// Helper function to analyze question type and intent
async function analyzeQuestion(message, userData) {
  try {
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Analyze the following question and determine:
1. Question type (nutrition, fitness, general, etc.)
2. User intent
3. Relevant data types needed to answer (choose from: conversation_history, user_profile, health_data, stats_data, dietary_preferences, recent_activities, calorie_intake, recent_meals)
4. Whether it's related to previous notifications
5. If it requires specific user data (calories, stats, etc.)`
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    });

    const analysis = JSON.parse(analysisResponse.choices[0].message.content);
    return {
      type: analysis.questionType,
      intent: analysis.intent,
      relevantDataTypes: analysis.relevantDataTypes,
      isNotificationRelated: analysis.isNotificationRelated,
      requiresUserData: analysis.requiresUserData
    };
  } catch (error) {
    console.error('Error analyzing question:', error);
    return {
      type: 'general',
      intent: 'unknown',
      relevantDataTypes: ['conversation_history'],
      isNotificationRelated: false,
      requiresUserData: false
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
