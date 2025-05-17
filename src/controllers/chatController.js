const chatService = require('../services/chatService').chatService;
const Chat = require('../models/Chat');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');
const { processMessageEmbedding } = require('../services/embeddingService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use relative path to ensure files are saved in the correct location
    const uploadPath = path.join(__dirname, '../../uploads/chat-images');
    console.log('Upload destination path:', uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images are allowed'));
    }
    cb(null, true);
  }
}).single('image');

const ENDPOINT_SEND = 'api/chat/message';

const chatController = {
  sendMessage: async (req, res) => {
    try {
      upload(req, res, async (err) => {
        // Debug: Log initial request (before multer processing)
        console.log('\n==== CHAT MESSAGE REQUEST ====');
        console.log('Request body:', req.body);
        console.log('Request file:', req.file ? {
          filename: req.file.filename,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path,
          destination: req.file.destination
        } : 'No file uploaded');
        console.log('User:', req.user ? { id: req.user._id } : 'No user');
        console.log('============================\n');
        
        logRequest(ENDPOINT_SEND, {
          body: req.body,
          file: req.file ? { 
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size
          } : null,
          user: req.user ? { id: req.user._id } : null
        });
        
        if (err) {
          const errorResponse = { success: false, message: err.message };
          logResponse(ENDPOINT_SEND, errorResponse);
          return res.status(400).json(errorResponse);
        }

        const { message, conversationId, parentMessageId } = req.body;
        
        // Get userId from the decoded token (could be _id or userId depending on how the token was created)
        const userId = req.user._id || req.user.userId;
        
        if (!userId) {
          const errorResponse = { 
            success: false, 
            message: 'User authentication failed. Please log in again.' 
          };
          logResponse(ENDPOINT_SEND, errorResponse);
          return res.status(401).json(errorResponse);
        }
        
        if (!message) {
          const errorResponse = { 
            success: false, 
            message: 'Message is required' 
          };
          logResponse(ENDPOINT_SEND, errorResponse);
          return res.status(400).json(errorResponse);
        }

        // Create or continue conversation
        const currentConversationId = conversationId || uuidv4();
        
        // Debug: Log conversation details
        logRequest(`${ENDPOINT_SEND}/conversation`, {
          userId,
          conversationId: currentConversationId,
          parentMessageId,
          hasImage: !!req.file
        });

        // Save user message
        const userMessage = new Chat({
          userId,
          conversationId: currentConversationId,
          parentMessageId,
          message,
          imageUrl: req.file ? `/uploads/chat-images/${req.file.filename}` : null,
          isAI: false,
          isEmbedded: false // Mark for embedding processing
        });
        await userMessage.save();
        
        // Process embedding for user message in the background
        console.log(`Starting embedding process for user message ${userMessage._id}...`);
        // Use setTimeout to ensure this runs after the response is sent
        setTimeout(() => {
          processMessageEmbedding(
            userId.toString(), 
            currentConversationId, 
            userMessage._id.toString(), 
            message, 
            false
          )
            .then(success => {
              if (success) {
                console.log(`Successfully processed embedding for user message ${userMessage._id}`);
                // Update the message to mark it as embedded
                Chat.findByIdAndUpdate(userMessage._id, { isEmbedded: true })
                  .catch(err => console.error(`Error updating isEmbedded flag for message ${userMessage._id}:`, err));
              } else {
                console.error(`Failed to process embedding for user message ${userMessage._id}`);
              }
            })
            .catch(err => console.error(`Error processing user message embedding for ${userMessage._id}:`, err));
        }, 100);
        
        // Debug: Log saved user message
        logResponse(`${ENDPOINT_SEND}/user-message`, {
          messageId: userMessage._id,
          conversationId: userMessage.conversationId,
          message: userMessage.message.substring(0, 50) + (userMessage.message.length > 50 ? '...' : ''),
          hasImage: !!userMessage.imageUrl
        });

        // Get AI response
        try {
          // Debug: Log AI processing request
          logRequest(`${ENDPOINT_SEND}/ai-process`, {
            userId,
            messageId: userMessage._id,
            conversationId: currentConversationId,
            hasImage: !!userMessage.imageUrl
          });
          
          const response = await chatService.processMessage(userId, message, {
            conversationId: currentConversationId,
            parentMessageId: userMessage._id.toString(),
            imageUrl: userMessage.imageUrl
          });
          
          // Debug: Log AI processing response
          logResponse(`${ENDPOINT_SEND}/ai-process`, {
            messageLength: response.message.length,
            hasImageAnalysis: !!response.imageAnalysis,
            hasFoodAnalysis: !!response.foodAnalysis,
            foodAnalysisItems: response.foodAnalysis ? response.foodAnalysis.foodItems.length : 0
          });

          // If we have food analysis results, enhance the AI response
          let enhancedResponse = response.message;
          if (response.foodAnalysis && response.foodAnalysis.foodItems && response.foodAnalysis.foodItems.length > 0) {
            const foodItems = response.foodAnalysis.foodItems;
            let analysisText = "\n\nHere's a detailed nutritional analysis of the food items I can see:\n\n";
            
            foodItems.forEach(item => {
              analysisText += `• ${item.name}:\n`;
              analysisText += `  - Calories: ${item.calories} per 100g\n`;
              analysisText += `  - Protein: ${item.protein}g\n`;
              analysisText += `  - Carbs: ${item.carbs}g\n`;
              analysisText += `  - Fat: ${item.fat}g\n`;
              analysisText += `  - Fiber: ${item.fiber}g\n`;
              analysisText += `  - Health Rating: ${item.isHealthy ? 'Healthy' : 'Less Healthy'}\n\n`;
            });
            
            analysisText += `Total estimated calories: ${response.foodAnalysis.totalCalories}\n\n`;
            analysisText += "Would you like me to provide any specific nutritional advice based on this analysis?";
            
            enhancedResponse = response.message + analysisText;
          }

          // Clean response of any markdown formatting that might have slipped through
          let cleanedResponse = enhancedResponse
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
            .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
            .replace(/^#+\s+/gm, '')         // Remove heading markers
            .replace(/^[-*+]\s+/gm, '')      // Remove bullet points
            .replace(/`([^`]+)`/g, '$1');    // Remove code formatting

          // Save AI response
          const aiMessage = new Chat({
            userId,
            conversationId: currentConversationId,
            parentMessageId: userMessage._id.toString(),
            message: cleanedResponse,
            isAI: true,
            isEmbedded: false, // Mark for embedding processing
            imageAnalysis: response.imageAnalysis,
            foodAnalysis: response.foodAnalysis
          });
          await aiMessage.save();
          
          // Process embedding for AI message in the background
          console.log(`Starting embedding process for AI message ${aiMessage._id}...`);
          // Use setTimeout to ensure this runs after the response is sent
          setTimeout(() => {
            processMessageEmbedding(
              userId.toString(), 
              currentConversationId, 
              aiMessage._id.toString(), 
              cleanedResponse, 
              true
            )
              .then(success => {
                if (success) {
                  console.log(`Successfully processed embedding for AI message ${aiMessage._id}`);
                  // Update the message to mark it as embedded
                  Chat.findByIdAndUpdate(aiMessage._id, { isEmbedded: true })
                    .catch(err => console.error(`Error updating isEmbedded flag for message ${aiMessage._id}:`, err));
                } else {
                  console.error(`Failed to process embedding for AI message ${aiMessage._id}`);
                }
              })
              .catch(err => console.error(`Error processing AI message embedding for ${aiMessage._id}:`, err));
          }, 100);
          
          // Debug: Log saved AI message
          logResponse(`${ENDPOINT_SEND}/ai-message`, {
            messageId: aiMessage._id,
            conversationId: aiMessage.conversationId,
            messageLength: aiMessage.message.length
          });

          const successResponse = {
            success: true,
            data: {
              conversationId: currentConversationId,
              messages: [
                {
                  id: userMessage._id,
                  message: userMessage.message,
                  imageUrl: userMessage.imageUrl,
                  isAI: false,
                  timestamp: userMessage.createdAt
                },
                {
                  id: aiMessage._id,
                  message: aiMessage.message,
                  isAI: true,
                  imageAnalysis: response.imageAnalysis,
                  foodAnalysis: response.foodAnalysis,
                  timestamp: aiMessage.createdAt
                }
              ]
            }
          };
          
          // Debug: Log final response
          logResponse(ENDPOINT_SEND, successResponse);
          
          // Print detailed AI response for debugging
          console.log('\n==== AI CHAT RESPONSE ====');
          console.log('Endpoint:', ENDPOINT_SEND);
          console.log('User Message:', message);
          console.log('AI Response:', aiMessage.message);
          console.log('Image Analysis:', response.imageAnalysis ? 'Present' : 'None');
          console.log('Food Analysis:', response.foodAnalysis ? JSON.stringify(response.foodAnalysis, null, 2) : 'None');
          console.log('========================\n');
          
          res.json(successResponse);
        } catch (aiError) {
          // Debug: Log AI processing error
          logError(`${ENDPOINT_SEND}/ai-process`, aiError);
          
          // Still return the user message even if AI processing failed
          const errorResponse = {
            success: false,
            error: aiError.message || 'Failed to process AI response',
            data: {
              conversationId: currentConversationId,
              messages: [
                {
                  id: userMessage._id,
                  message: userMessage.message,
                  imageUrl: userMessage.imageUrl,
                  isAI: false,
                  timestamp: userMessage.createdAt
                }
              ]
            }
          };
          
          logResponse(ENDPOINT_SEND, errorResponse);
          res.status(500).json(errorResponse);
        }
      });
    } catch (error) {
      console.error('Error in sendMessage:', error);
      
      // Debug: Log error
      logError(ENDPOINT_SEND, error);
      
      const errorResponse = { 
        success: false, 
        message: error.message || 'Failed to process message' 
      };
      
      res.status(500).json(errorResponse);
    }
  },

  getChatHistory: async (req, res) => {
    const ENDPOINT_HISTORY = 'api/chat/history';
    
    try {
      // Debug: Log request
      logRequest(ENDPOINT_HISTORY, req);
      
      const userId = req.user._id || req.user.userId;
      
      if (!userId) {
        const errorResponse = { 
          success: false, 
          message: 'User authentication failed. Please log in again.' 
        };
        logResponse(ENDPOINT_HISTORY, errorResponse);
        return res.status(401).json(errorResponse);
      }
      
      const { conversationId, limit = 50, before } = req.query;
      
      let query = { userId };
      
      if (conversationId) {
        query.conversationId = conversationId;
      }
      
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }
      
      // Debug: Log database query
      logRequest(`${ENDPOINT_HISTORY}/db-query`, {
        query,
        limit,
        sort: { createdAt: -1 }
      });

      // First get the list of conversation IDs
      const conversationIds = await Chat.distinct('conversationId', query);
      
      // Then get messages for each conversation, sorted chronologically
      let messages = [];
      for (const convId of conversationIds) {
        const convMessages = await Chat.find({ ...query, conversationId: convId })
          .sort({ createdAt: 1 }) // Sort chronologically (oldest first) for proper conversation flow
          .limit(parseInt(limit))
          .lean();
        
        messages = [...messages, ...convMessages];
      }
      
      // If we have too many messages, trim to the limit
      if (messages.length > parseInt(limit)) {
        messages = messages.slice(0, parseInt(limit));
      }
        
      // Debug: Log query results
      logResponse(`${ENDPOINT_HISTORY}/db-query`, {
        count: messages.length,
        conversationIds: [...new Set(messages.map(m => m.conversationId))],
        timeRange: messages.length > 0 ? {
          oldest: messages[messages.length - 1].createdAt,
          newest: messages[0].createdAt
        } : null
      });

      // Group messages by conversation
      const conversations = messages.reduce((acc, msg) => {
        if (!acc[msg.conversationId]) {
          acc[msg.conversationId] = [];
        }
        acc[msg.conversationId].push({
          id: msg._id,
          message: msg.message,
          imageUrl: msg.imageUrl,
          isAI: msg.isAI,
          parentMessageId: msg.parentMessageId,
          timestamp: msg.createdAt
        });
        return acc;
      }, {});
      
      // Debug: Log conversation grouping
      logResponse(`${ENDPOINT_HISTORY}/grouping`, {
        conversationCount: Object.keys(conversations).length,
        messageCountByConversation: Object.entries(conversations).map(([id, msgs]) => ({
          id,
          count: msgs.length
        }))
      });

      const successResponse = {
        success: true,
        data: {
          conversations: Object.entries(conversations).map(([id, messages]) => ({
            id,
            messages: messages // Already in chronological order, no need to reverse
          }))
        }
      };
      
      // Debug: Log response (with truncated message content)
      const debugResponse = {
        ...successResponse,
        data: {
          conversations: successResponse.data.conversations.map(conv => ({
            id: conv.id,
            messageCount: conv.messages.length,
            firstMessage: conv.messages.length > 0 ? {
              id: conv.messages[0].id,
              isAI: conv.messages[0].isAI,
              timestamp: conv.messages[0].timestamp
            } : null
          }))
        }
      };
      logResponse(ENDPOINT_HISTORY, debugResponse);
      
      res.json(successResponse);
    } catch (error) {
      console.error('Error in getChatHistory:', error);
      
      // Debug: Log error
      logError(ENDPOINT_HISTORY, error);
      
      const errorResponse = { 
        success: false, 
        message: error.message || 'Failed to fetch chat history' 
      };
      
      res.status(500).json(errorResponse);
    }
  },

  deleteConversation: async (req, res) => {
    const ENDPOINT_DELETE = 'api/chat/conversation/:conversationId';
    
    try {
      // Debug: Log request
      logRequest(ENDPOINT_DELETE, req);
      
      const userId = req.user._id || req.user.userId;
      
      if (!userId) {
        const errorResponse = { 
          success: false, 
          message: 'User authentication failed. Please log in again.' 
        };
        logResponse(ENDPOINT_DELETE, errorResponse);
        return res.status(401).json(errorResponse);
      }
      
      const { conversationId } = req.params;

      if (!conversationId) {
        const errorResponse = {
          success: false,
          message: 'Conversation ID is required'
        };
        logResponse(ENDPOINT_DELETE, errorResponse);
        return res.status(400).json(errorResponse);
      }
      
      // Debug: Log delete operation
      logRequest(`${ENDPOINT_DELETE}/db-delete`, {
        userId,
        conversationId
      });

      // First, count messages to be deleted for debugging
      const messageCount = await Chat.countDocuments({ userId, conversationId });
      
      // Debug: Log message count
      logResponse(`${ENDPOINT_DELETE}/message-count`, {
        conversationId,
        messageCount
      });
      
      // Perform deletion
      const deleteResult = await Chat.deleteMany({ userId, conversationId });
      
      // Debug: Log deletion result
      logResponse(`${ENDPOINT_DELETE}/db-delete`, {
        conversationId,
        deletedCount: deleteResult.deletedCount,
        acknowledged: deleteResult.acknowledged
      });

      const successResponse = {
        success: true,
        message: 'Conversation deleted successfully',
        data: {
          conversationId,
          deletedCount: deleteResult.deletedCount
        }
      };
      
      // Debug: Log response
      logResponse(ENDPOINT_DELETE, successResponse);
      
      res.json(successResponse);
    } catch (error) {
      console.error('Error in deleteConversation:', error);
      
      // Debug: Log error
      logError(ENDPOINT_DELETE, error);
      
      const errorResponse = {
        success: false,
        message: error.message || 'Failed to delete conversation'
      };
      
      res.status(500).json(errorResponse);
    }
  }
};

module.exports = chatController;