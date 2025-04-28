const { createClient } = require('@clickhouse/client');
const OpenAI = require('openai');
const Chat = require('../models/Chat');
const fs = require('fs');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');

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
        timestamp DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY timestamp
    `,
  });
  console.log("Table 'chat_history' initialized.");
};

// Insert chat record into the database
const insertChatRecord = async (userMessage, aiResponse) => {
  await client.insert({
    table: 'chat_history',
    values: [
      {
        user_message: userMessage,
        ai_response: aiResponse,
        timestamp: new Date().toISOString(),
      },
    ],
    format: 'JSONEachRow',
  });
  console.log('Chat record inserted.');
};

// Fetch chat history
const fetchChatHistory = async () => {
  const rows = await client.query({
    query: 'SELECT * FROM chat_history ORDER BY timestamp DESC',
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
      
      let prompt = "You are an AI assistant specialized in nutrition and fitness. Provide detailed, informative, and supportive responses to users' questions. Analyze food images when provided and offer insights about nutritional content, ingredients, and possible healthier alternatives. Give practical and easy-to-follow fitness advice suitable for beginners and advanced users. Always maintain a friendly, conversational, and positive tone. Responses must be clear, natural, and easy to understand without using any special characters like * or formatting symbols. Each response should be between 100 and 500 words, offering valuable and actionable information that helps users improve their nutrition and fitness journey.";
      let imageContent = '';

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
          prompt += `\nBased on the image showing: ${imageContent}\n`;
        } catch (imageError) {
          // Debug: Log image processing error
          logError(`${ENDPOINT_SERVICE}/image-analysis`, imageError);
          
          // Continue without image analysis
          prompt += "\nNote: There was an image attached, but I couldn't analyze it properly.\n";
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
          .sort({ createdAt: -1 })
          .limit(15)  // Increased from 5 to 15 for better conversation context
          .lean();
          
          // Debug: Log history retrieval results
          logResponse(`${ENDPOINT_SERVICE}/conversation-history`, {
            messageCount: history.length,
            messageTypes: history.map(msg => msg.isAI ? 'AI' : 'User')
          });

          if (history.length > 0) {
            prompt += "\nBased on our conversation:\n";
            history.reverse().forEach(msg => {
              prompt += `${msg.isAI ? 'Coach' : 'User'}: ${msg.message}\n`;
            });
          }
        } catch (historyError) {
          // Debug: Log history retrieval error
          logError(`${ENDPOINT_SERVICE}/conversation-history`, historyError);
          
          // Continue without conversation history
          prompt += "\nNote: I couldn't retrieve our conversation history.\n";
        }
      }

      prompt += `\nUser: ${message}\nCoach:`;
      
      // Debug: Log final prompt
      logRequest(`${ENDPOINT_SERVICE}/openai-completion`, {
        model: "gpt-4-turbo-preview",
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 100) + '...'
      });

      // Get AI response
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });
      
      // Debug: Log OpenAI response
      logResponse(`${ENDPOINT_SERVICE}/openai-completion`, {
        responseLength: response.choices[0].message.content.length,
        preview: response.choices[0].message.content.substring(0, 50) + '...',
        usage: response.usage
      });

      const result = {
        message: response.choices[0].message.content.trim(),
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
