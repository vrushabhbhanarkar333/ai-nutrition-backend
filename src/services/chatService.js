const { createClient } = require('@clickhouse/client');
const OpenAI = require('openai');
const Chat = require('../models/Chat');
const fs = require('fs');
const path = require('path');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');
const { findSimilarMessages } = require('./embeddingService');
const foodService = require('./foodService');

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
      
      // System prompt that defines the AI's behavior - simplified for faster responses
      const systemPrompt = "You are a nutrition and fitness assistant. Keep responses brief and helpful. When food analysis data is provided, include it in your response. Reference previous conversations when relevant. Be friendly and conversational. Avoid special formatting characters. Provide practical advice that helps users improve their nutrition and fitness.";
      
      let imageContent = '';
      let foodAnalysisResult = null;
      // Initialize messages array with system message
      const messages = [
        {
          role: "system",
          content: systemPrompt
        }
      ];

      // If there's an image, analyze it first
      if (options.imageUrl) {
        console.log('\n==== IMAGE ANALYSIS ATTEMPT ====');
        console.log('Image URL:', options.imageUrl);
        try {
          // Debug: Log image processing
          logRequest(`${ENDPOINT_SERVICE}/image-analysis`, {
            imagePath: options.imageUrl
          });
          
          // Handle both relative and absolute paths
          let imagePath;
          
          // If the path is already absolute, use it directly
          if (options.imageUrl.startsWith('/') || options.imageUrl.includes(':/')) {
            imagePath = options.imageUrl;
          } else {
            // Otherwise, construct the path based on environment
            if (process.env.NODE_ENV === 'production') {
              // In production, use path relative to the root directory
              imagePath = path.join(process.cwd(), options.imageUrl);
            } else {
              // In development, use the absolute path
              imagePath = path.join('d:/freelance_project/ai-nutrition-backend', options.imageUrl);
            }
          }
          
          console.log(`Reading image file from: ${imagePath}`);
          
          // Check if file exists
          if (!fs.existsSync(imagePath)) {
            console.error(`Image file does not exist at path: ${imagePath}`);
            console.log('Trying alternative path...');
            
            // Try an alternative path
            const altPath = path.join(process.cwd(), options.imageUrl.replace(/^\//, ''));
            console.log(`Trying alternative path: ${altPath}`);
            
            if (fs.existsSync(altPath)) {
              imagePath = altPath;
              console.log(`Found image at alternative path: ${imagePath}`);
            } else {
              throw new Error('Image file not found');
            }
          }
          
          const imageBuffer = fs.readFileSync(imagePath);
          console.log(`Image buffer size: ${imageBuffer.length} bytes`);
          
          // Use the food service to analyze the image
          console.log('Calling food service to analyze image...');
          try {
            foodAnalysisResult = await foodService.analyzeFood(imageBuffer);
            console.log('Food analysis result:', JSON.stringify(foodAnalysisResult));
          } catch (foodError) {
            console.error('Error in food analysis:', foodError);
            // We'll continue with the Vision API below
          }
          
          if (foodAnalysisResult && !foodAnalysisResult.error) {
            // Format the food analysis result into a readable message
            const foodItems = foodAnalysisResult.foodItems;
            let analysisText = "I've analyzed your food image and identified the following items:\n\n";
            
            foodItems.forEach(item => {
              analysisText += `${item.name}: ${item.calories} calories per 100g. `;
              analysisText += `Contains ${item.protein}g protein, ${item.carbs}g carbs, ${item.fat}g fat, and ${item.fiber}g fiber. `;
              analysisText += `This food is generally considered ${item.isHealthy ? 'healthy' : 'less healthy'}.\n\n`;
            });
            
            analysisText += `Total estimated calories: ${foodAnalysisResult.totalCalories}`;
            
            imageContent = analysisText;
          } else {
            // Fall back to Vision API
            console.log('Food analysis failed or returned an error, falling back to Vision API');
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
                      text: "Analyze this food image in detail. Describe what you see, identify the foods, estimate nutritional content, and suggest any health considerations. Be thorough in your analysis."
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
              max_tokens: 500
            });
            
            // Debug: Log Vision API response
            logResponse(`${ENDPOINT_SERVICE}/vision-api`, {
              responseLength: visionResponse.choices[0].message.content.length,
              preview: visionResponse.choices[0].message.content.substring(0, 50) + '...',
              usage: visionResponse.usage
            });

            imageContent = visionResponse.choices[0].message.content;
          }
          
          console.log(`Image analysis: ${imageContent.substring(0, 100)}...`);
          
          // Add image analysis as a system message
          messages.push({
            role: "system",
            content: `I've analyzed the image the user shared. Here's what I can see: ${imageContent}`
          });
          
          // Don't add a direct assistant message about the image - we'll let the model generate a complete response
        } catch (imageError) {
          // Debug: Log image processing error
          console.error('Error processing image:', imageError);
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
      
      // Add the current user message, including reference to the image if one was uploaded
      if (options.imageUrl) {
        messages.push({
          role: "user",
          content: `${message} (I've also shared an image for you to analyze)`
        });
      } else {
        messages.push({
          role: "user",
          content: message
        });
      }
      
      // If we have food analysis, make sure it's prominently included in the system message
      if (foodAnalysisResult && !foodAnalysisResult.error) {
        // Add a specific system message about the food analysis
        messages.push({
          role: "system",
          content: `IMPORTANT: The user has shared an image of food. Your analysis MUST include the following nutritional information: ${JSON.stringify(foodAnalysisResult, null, 2)}`
        });
      }
      
      // Debug: Log messages array
      logRequest(`${ENDPOINT_SERVICE}/openai-completion`, {
        model: "gpt-4-turbo-preview",
        messagesCount: messages.length,
        preview: JSON.stringify(messages).substring(0, 100) + '...'
      });

      // Get AI response with proper conversation context - use faster model for better UX
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Use faster model for quicker responses
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
      
      // If we have food analysis, include it in the response
      if (foodAnalysisResult && !foodAnalysisResult.error) {
        // Generate a food analysis response
        let foodAnalysis = `I've analyzed your food image and identified the following:\n\n`;
        
        foodAnalysisResult.foodItems.forEach(item => {
          foodAnalysis += `• ${item.name}: ${item.calories} calories per 100g serving\n`;
          foodAnalysis += `  - Protein: ${item.protein}g\n`;
          foodAnalysis += `  - Carbs: ${item.carbs}g\n`;
          foodAnalysis += `  - Fat: ${item.fat}g\n`;
          foodAnalysis += `  - Fiber: ${item.fiber}g\n`;
          foodAnalysis += `  - Health assessment: ${item.isHealthy ? 'Healthy choice' : 'Less healthy option'}\n\n`;
        });
        
        foodAnalysis += `Total estimated calories: ${foodAnalysisResult.totalCalories}\n\n`;
        
        // Combine AI response with food analysis
        cleanedResponse = foodAnalysis + cleanedResponse;
      }

      const result = {
        message: cleanedResponse,
        imageAnalysis: imageContent || null,
        foodAnalysis: foodAnalysisResult || null
      };
      
      // Debug: Log final result
      logResponse(ENDPOINT_SERVICE, {
        messageLength: result.message.length,
        hasImageAnalysis: !!result.imageAnalysis,
        imageAnalysisLength: result.imageAnalysis ? result.imageAnalysis.length : 0,
        hasFoodAnalysis: !!result.foodAnalysis
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
