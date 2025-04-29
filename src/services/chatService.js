const { createClient } = require('@clickhouse/client');
const OpenAI = require('openai');
const Chat = require('../models/Chat');
const fs = require('fs');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');
const { findSimilarMessages } = require('./embeddingService');

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
      
      // System prompt that defines the AI's behavior
      const systemPrompt = "You are an AI assistant specialized in nutrition and fitness. Provide detailed, informative, and supportive responses to users' questions. When relevant information from the user's previous conversations is provided, reference it naturally in your response to personalize your advice. Analyze food images when provided and offer insights about nutritional content, ingredients, and possible healthier alternatives. Give practical and easy-to-follow fitness advice suitable for beginners and advanced users. Always maintain a friendly, conversational, and positive tone. Responses must be clear, natural, and easy to understand without using any special characters like * or # or formatting symbols. Each response should be between 100 and 500 words, offering valuable and actionable information that helps users improve their nutrition and fitness journey.";
      
      let imageContent = '';
      // Initialize messages array with system message
      const messages = [
        {
          role: "system",
          content: systemPrompt
        }
      ];

      // If there's an image, analyze it first
      if (options.imageUrl) {
        try {
          // Debug: Log image processing
          logRequest(`${ENDPOINT_SERVICE}/image-analysis`, {
            imagePath: options.imageUrl
          });
          
          const imagePath = '.' + options.imageUrl;
          const imageBuffer = fs.readFileSync(imagePath);
          const base64Image = imageBuffer.toString('base64');
          
          // Debug: Log OpenAI Vision API call
          logRequest(`${ENDPOINT_SERVICE}/vision-api`, {
            model: "gpt-4-vision-preview",
            imageSize: Math.round(base64Image.length / 1024) + 'KB'
          });

          // Get image description from OpenAI Vision API
          const visionResponse = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this food image and describe what you see in terms of nutritional content:"
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${base64Image}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 150
          });
          
          // Debug: Log Vision API response
          logResponse(`${ENDPOINT_SERVICE}/vision-api`, {
            responseLength: visionResponse.choices[0].message.content.length,
            preview: visionResponse.choices[0].message.content.substring(0, 50) + '...',
            usage: visionResponse.usage
          });

          imageContent = visionResponse.choices[0].message.content;
          
          // Add image analysis as an assistant message
          messages.push({
            role: "assistant",
            content: `I've analyzed your food image. ${imageContent}`
          });
        } catch (imageError) {
          // Debug: Log image processing error
          logError(`${ENDPOINT_SERVICE}/image-analysis`, imageError);
          
          // Continue without image analysis
          messages.push({
            role: "assistant",
            content: "I notice you've shared an image, but I couldn't analyze it properly. Let me still try to help with your question."
          });
        }
      }

      // Get conversation history if this is part of a thread
      if (options.conversationId) {
        try {
          // Debug: Log conversation history retrieval
          logRequest(`${ENDPOINT_SERVICE}/conversation-history`, {
            conversationId: options.conversationId
          });
          
          const history = await Chat.find({
            conversationId: options.conversationId,
            createdAt: { 
              $lt: new Date() 
            }
          })
          .sort({ createdAt: 1 }) // Sort in chronological order (oldest first)
          .limit(15)  // Limit to 15 messages for context
          .lean();
          
          // Debug: Log history retrieval results
          logResponse(`${ENDPOINT_SERVICE}/conversation-history`, {
            messageCount: history.length,
            messageTypes: history.map(msg => msg.isAI ? 'AI' : 'User')
          });

          if (history.length > 0) {
            // Add each message from history to the messages array with proper role
            history.forEach(msg => {
              messages.push({
                role: msg.isAI ? "assistant" : "user",
                content: msg.message
              });
            });
          }
        } catch (historyError) {
          // Debug: Log history retrieval error
          logError(`${ENDPOINT_SERVICE}/conversation-history`, historyError);
          
          // Add a note about missing history
          messages.push({
            role: "system",
            content: "Note: Unable to retrieve conversation history. Responding based on current message only."
          });
        }
      }

      // Find relevant previous messages using vector search
      try {
        logRequest(`${ENDPOINT_SERVICE}/vector-search`, {
          userId,
          messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        });
        
        const similarMessages = await findSimilarMessages(userId, message, 3);
        
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
          // Add a system message explaining the context
          messages.push({
            role: "system",
            content: "I found some relevant information from your previous conversations that might help with your current question:"
          });
          
          // Add each similar message with its context
          similarMessages.forEach(m => {
            messages.push({
              role: m.is_ai ? "assistant" : "user",
              content: m.message
            });
          });
          
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
      
      // Debug: Log messages array
      logRequest(`${ENDPOINT_SERVICE}/openai-completion`, {
        model: "gpt-4-turbo-preview",
        messagesCount: messages.length,
        preview: JSON.stringify(messages).substring(0, 100) + '...'
      });

      // Get AI response with proper conversation context
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      });
      
      // Debug: Log OpenAI response
      logResponse(`${ENDPOINT_SERVICE}/openai-completion`, {
        responseLength: response.choices[0].message.content.length,
        preview: response.choices[0].message.content.substring(0, 50) + '...',
        usage: response.usage
      });

      // Process the response to ensure no special characters
      let cleanedResponse = response.choices[0].message.content.trim();
      
      // Remove any markdown formatting if present (*, #, etc.)
      cleanedResponse = cleanedResponse
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
        .replace(/^#+\s+/gm, '')         // Remove heading markers
        .replace(/^[-*+]\s+/gm, '• ')    // Replace bullet points with a simple bullet
        .replace(/`([^`]+)`/g, '$1');    // Remove code formatting

      const result = {
        message: cleanedResponse,
        imageAnalysis: imageContent || null
      };
      
      // Debug: Log final result
      logResponse(ENDPOINT_SERVICE, {
        messageLength: result.message.length,
        hasImageAnalysis: !!result.imageAnalysis,
        imageAnalysisLength: result.imageAnalysis ? result.imageAnalysis.length : 0
      });
      
      return result;
    } catch (error) {
      console.error('Error in processMessage:', error);
      
      // Debug: Log service error
      logError(ENDPOINT_SERVICE, error);
      
      throw error;
    }
  }
};

module.exports = {
  initializeChatTable,
  insertChatRecord,
  fetchChatHistory,
  chatService,
};
