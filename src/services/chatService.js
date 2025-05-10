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
const healthKitService = require('./healthKitService');
const Meal = require('../models/Meal');

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
        recent_meals: userData.recentMeals,
        healthKitData: userData.healthKitData
      };

      // Get enhanced system prompt
      const systemPrompt = await getEnhancedSystemPrompt(userData, questionAnalysis);
      
      // Initialize messages array with enhanced system prompt
      const messages = [
        {
          role: "system",
          content: systemPrompt
        }
      ];

      // Add conversation history if relevant
      if (questionAnalysis.relevantDataTypes.includes('conversation_history')) {
        const history = await fetchChatHistory(options.conversationId);
        if (history.length > 0) {
          messages.push({
            role: "system",
            content: "Previous conversation context:"
          });
          history.forEach(msg => {
            messages.push({
              role: msg.isAI ? "assistant" : "user",
              content: msg.message
            });
          });
        }
      }

      // Add notification history if relevant
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
              content: `Previous notification: ${notification.question}\nYour response: ${notification.answer}`
            });
          });
        }
      }

      // Find relevant previous messages using vector search
      try {
        logRequest(`${ENDPOINT_SERVICE}/vector-search`, {
          userId,
          messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        });
        
        // Get similar messages with higher weight for recent data
        const similarMessages = await findSimilarMessages(userId, message, 5);
        
        logResponse(`${ENDPOINT_SERVICE}/vector-search`, {
          count: similarMessages.length,
          messages: similarMessages.map(m => ({
            similarity: m.similarity,
            isAI: m.is_ai,
            preview: m.message.substring(0, 30) + '...'
          }))
        });
        
        // If we found similar messages, add them as context
        if (similarMessages.length > 0) {
          // Group messages by type
          const healthKitMessages = similarMessages.filter(m => m.metadata?.message_type === 'healthkit_data');
          const mealMessages = similarMessages.filter(m => m.metadata?.message_type === 'meal_data');
          const chatMessages = similarMessages.filter(m => m.metadata?.message_type === 'chat');

          // Add a system message explaining the context
          messages.push({
            role: "system",
            content: "I found some relevant information from your previous conversations and data that might help with your current question:"
          });

          // Add health data context if available
          if (healthKitMessages.length > 0) {
            messages.push({
              role: "system",
              content: "Recent Health Data:\n" + healthKitMessages.map(m => m.message).join('\n')
            });
          }

          // Add meal data context if available
          if (mealMessages.length > 0) {
            messages.push({
              role: "system",
              content: "Recent Meal Data:\n" + mealMessages.map(m => m.message).join('\n')
            });
          }

          // Add relevant chat history
          if (chatMessages.length > 0) {
            messages.push({
              role: "system",
              content: "Relevant Previous Conversations:\n" + chatMessages.map(m => 
                `${m.is_ai ? 'Assistant' : 'User'}: ${m.message}`
              ).join('\n')
            });
          }
          
          // Add a separator
          messages.push({
            role: "system",
            content: "Now, let me address your current question specifically."
          });
        }
      } catch (vectorError) {
        // Log error but continue without vector search results
        logError(`${ENDPOINT_SERVICE}/vector-search`, vectorError);
      }

      // Add the current user message
      messages.push({
        role: "user",
        content: message
      });

      // Get AI response with enhanced context
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
        top_p: 0.9,
        stop: ["\n\n", "User:", "Assistant:"]
      });

      // Process and clean the response
      let cleanedResponse = response.choices[0].message.content.trim();
      
      // Format the response based on question type
      if (questionAnalysis.type === 'meal') {
        // For meal-related questions, ensure proper formatting of meal data
        cleanedResponse = cleanedResponse
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/^#+\s+/gm, '')
          .replace(/^[-*+]\s+/gm, '• ')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/(\d+\.\s*[A-Za-z]+:)/g, '\n$1') // Add line breaks before meal entries
          .replace(/(\s*-\s*[A-Za-z]+:)/g, '\n  $1'); // Indent meal details
      } else {
        // For other questions, use standard formatting
        cleanedResponse = cleanedResponse
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/^#+\s+/gm, '')
          .replace(/^[-*+]\s+/gm, '• ')
          .replace(/`([^`]+)`/g, '$1');
      }

      // Store the interaction in vector database with enhanced metadata
      await processMessageEmbedding(
        userId,
        options.conversationId,
        options.messageId || Date.now().toString(),
        message,
        false,
        {
          ...messageMetadata,
          question_type: questionAnalysis.type,
          question_intent: questionAnalysis.intent,
          relevant_data_types: questionAnalysis.relevantDataTypes,
          has_health_data: questionAnalysis.isHealthRelated,
          has_meal_data: questionAnalysis.isMealRelated
        },
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
          response_quality: 'high',
          question_type: questionAnalysis.type,
          question_intent: questionAnalysis.intent,
          relevant_data_types: questionAnalysis.relevantDataTypes
        },
        {
          ...messageContext,
          response_context: JSON.stringify({
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            max_tokens: 800,
            presence_penalty: 0.6,
            frequency_penalty: 0.3,
            top_p: 0.9
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
          healthKitData: userData.healthKitData
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
const gatherUserData = async (userId) => {
  try {
    // Get user profile
    const user = await User.findById(userId);
    
    // Get health data
    const healthData = await HealthData.findOne({ userId });
    
    // Get stats data
    const statsData = await StatsData.findOne({ userId });
    
    // Get activity data
    const activityData = await ActivityData.findOne({ userId });
    
    // Get dietary preferences
    const dietaryPreferences = await DietaryPreferences.findOne({ userId });
    
    // Get latest HealthKit data (steps only)
    const latestHealthKitData = await healthKitService.getLatestHealthKitData(userId);
    
    // Get aggregated HealthKit data for the last 7 days (steps only)
    const aggregatedHealthKitData = await healthKitService.getAggregatedHealthKitData(userId, 7);
    
    // Get recent meals from our app's implementation
    const recentMeals = await Meal.find({ userId })
      .sort({ date: -1 })
      .limit(5)
      .lean();

    return {
      profile: user,
      healthData,
      statsData,
      activityData,
      dietaryPreferences,
      healthKitData: {
        latest: latestHealthKitData,
        aggregated: aggregatedHealthKitData
      },
      recentMeals
    };
  } catch (error) {
    console.error('Error gathering user data:', error);
    throw error;
  }
};

// Helper function to analyze question type and intent
const analyzeQuestion = async (message, userData) => {
  try {
    // Check for health-related keywords (steps only)
    const healthKeywords = [
      'step', 'walk', 'run', 'health', 'fitness', 'exercise', 'activity',
      'steps', 'walking', 'running', 'distance', 'energy', 'workout', 'training'
    ];

    // Check for meal-related keywords
    const mealKeywords = [
      'meal', 'food', 'eat', 'breakfast', 'lunch', 'dinner', 'snack',
      'calorie', 'protein', 'carb', 'fat', 'nutrition', 'diet', 'dietary',
      'intake', 'consumption', 'portion', 'serving', 'recipe', 'cook',
      'preparation', 'ingredient', 'nutrient', 'vitamin', 'mineral',
      'macro', 'micro', 'dietary fiber', 'sugar', 'sodium', 'cholesterol'
    ];

    const messageLower = message.toLowerCase();
    const isHealthRelated = healthKeywords.some(keyword => messageLower.includes(keyword));
    const isMealRelated = mealKeywords.some(keyword => messageLower.includes(keyword));

    // Determine relevant data types
    const relevantDataTypes = ['user_profile', 'health_data', 'stats_data'];
    if (isHealthRelated) {
      relevantDataTypes.push('healthkit_data');
    }
    if (isMealRelated) {
      relevantDataTypes.push('meal_data');
    }

    // Determine question type and intent
    let type = 'general';
    let intent = 'information';

    if (isHealthRelated) {
      type = 'health';
      if (messageLower.includes('how many') || messageLower.includes('what is my')) {
        intent = 'metric_query';
      } else if (messageLower.includes('compare') || messageLower.includes('trend')) {
        intent = 'comparison';
      } else if (messageLower.includes('goal') || messageLower.includes('target')) {
        intent = 'goal_oriented';
      } else if (messageLower.includes('improve') || messageLower.includes('better')) {
        intent = 'improvement';
      }
    } else if (isMealRelated) {
      type = 'meal';
      if (messageLower.includes('what did i eat') || messageLower.includes('what was my')) {
        intent = 'meal_history';
      } else if (messageLower.includes('suggest') || messageLower.includes('recommend')) {
        intent = 'meal_suggestion';
      } else if (messageLower.includes('track') || messageLower.includes('log')) {
        intent = 'meal_tracking';
      } else if (messageLower.includes('analyze') || messageLower.includes('nutrition')) {
        intent = 'meal_analysis';
      }
    }

    return {
      type,
      intent,
      relevantDataTypes,
      isHealthRelated,
      isMealRelated
    };
  } catch (error) {
    console.error('Error analyzing question:', error);
    return {
      type: 'general',
      intent: 'information',
      relevantDataTypes: ['user_profile'],
      isHealthRelated: false,
      isMealRelated: false
    };
  }
};

// Helper function to fetch notification history
const fetchNotificationHistory = async (userId) => {
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
};

// Enhanced system prompt with better context handling
const getEnhancedSystemPrompt = async (userData, questionAnalysis) => {
  return `You are an advanced AI nutrition and fitness assistant with deep expertise in health analytics and personalized guidance. Your role is to provide insightful, data-driven responses that feel natural and conversational while being highly informative.

1. Question Analysis and Response Strategy:
   - First, analyze the user's question to understand:
     * The specific information they're seeking
     * Any implicit questions or concerns
     * The context and timing of their query
     * Their current health and nutrition situation
   - Then, structure your response to:
     * Address the explicit question directly
     * Anticipate and answer related questions
     * Provide context and significance
     * Offer actionable insights

2. Data Integration and Context:
   ${userData.healthKitData.latest ? `
   Latest Step Count:
   - Steps: ${userData.healthKitData.latest.steps?.count || 0} (Goal: ${userData.healthKitData.latest.steps?.goal || 0})
   - Progress: ${Math.round(userData.healthKitData.latest.steps?.progress || 0)}%` : ''}

   ${userData.healthKitData.aggregated ? `
   Last 7 Days Step Summary:
   - Average Steps: ${Math.round(userData.healthKitData.aggregated.avgSteps || 0)}
   - Total Steps: ${userData.healthKitData.aggregated.totalSteps || 0}
   - Average Progress: ${Math.round(userData.healthKitData.aggregated.avgProgress || 0)}%` : ''}

   ${userData.recentMeals && userData.recentMeals.length > 0 ? `
   Recent Meals (Last 5):
   ${userData.recentMeals.map((meal, index) => `
   ${index + 1}. ${meal.type}: ${meal.name}
      - Time: ${new Date(meal.date).toLocaleTimeString()}
      - Calories: ${meal.calories} kcal
      - Protein: ${meal.protein}g
      - Carbs: ${meal.carbs}g
      - Fat: ${meal.fat}g`).join('\n')}` : ''}

3. Response Framework:
   Your response should follow this structure based on the question type:

   For Step Count Questions:
   a) Direct Answer:
      - Current step count and progress
      - Comparison with daily goal
      - Recent trend analysis
   
   b) Context and Analysis:
      - Weekly average comparison
      - Progress towards goals
      - Notable patterns or changes
   
   c) Recommendations:
      - Suggestions for improvement
      - Tips for increasing activity
      - Goal adjustment if needed

   For Meal History Questions:
   a) Direct Answer:
      - List of recent meals with details
      - Total calories and macros
      - Meal timing patterns
   
   b) Nutritional Analysis:
      - Macro distribution
      - Meal balance assessment
      - Dietary pattern insights
   
   c) Recommendations:
      - Meal timing suggestions
      - Nutritional balance tips
      - Portion size guidance

4. Response Style Guidelines:
   - Be conversational but professional
   - Use natural language to explain data
   - Break down complex information into digestible parts
   - Use analogies or comparisons when helpful
   - Maintain a supportive and encouraging tone
   - Be precise with numbers but explain their significance
   - Avoid medical advice unless explicitly requested

5. Question Analysis Details:
   - Type: ${questionAnalysis.type}
   - Intent: ${questionAnalysis.intent}
   - Relevant Data Types: ${questionAnalysis.relevantDataTypes.join(', ')}

6. Quality Requirements:
   - Accuracy: Double-check all numbers and calculations
   - Relevance: Focus on information that directly answers the question
   - Completeness: Address both explicit and implicit aspects of the question
   - Clarity: Use clear, simple language to explain complex data
   - Actionability: Provide specific, implementable recommendations
   - Context: Connect with user's history and goals
   - Natural Flow: Make the response feel like a natural conversation

Remember to:
1. Think step by step about what the user is really asking
2. Consider both the explicit question and implicit concerns
3. Use the available data to provide specific, personalized insights
4. Explain the significance of the data in simple terms
5. Provide actionable recommendations when appropriate
6. Maintain a natural, conversational tone
7. Connect the response with previous interactions when relevant
8. Anticipate and address potential follow-up questions

Your goal is to make the user feel like they're talking to a knowledgeable health and nutrition expert who understands their specific situation and can provide personalized, actionable insights.`;
};

module.exports = {
  initializeChatTable,
  insertChatRecord,
  fetchChatHistory,
  chatService,
};
