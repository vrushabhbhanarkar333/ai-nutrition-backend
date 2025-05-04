const EngagementMessage = require('../models/EngagementMessage');
const Chat = require('../models/Chat');
const { v4: uuidv4 } = require('uuid');
const { processMessageEmbedding } = require('../services/embeddingService');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');

const ENDPOINT = 'api/engagement';

const engagementController = {
  // Get a random engagement message
  getRandomMessage: async (req, res) => {
    try {
      logRequest(`${ENDPOINT}/random`, req);
      
      const userId = req.user._id;
      const { category } = req.query;
      
      // Build query
      const query = { isActive: true };
      if (category) {
        query.category = category;
      }
      
      // Get count of matching messages
      const count = await EngagementMessage.countDocuments(query);
      
      if (count === 0) {
        const errorResponse = {
          success: false,
          error: 'No engagement messages found'
        };
        logResponse(`${ENDPOINT}/random`, errorResponse);
        return res.status(404).json(errorResponse);
      }
      
      // Get a random message
      const random = Math.floor(Math.random() * count);
      const message = await EngagementMessage.findOne(query).skip(random);
      
      const successResponse = {
        success: true,
        data: {
          id: message._id,
          category: message.category,
          message: message.message
        }
      };
      
      logResponse(`${ENDPOINT}/random`, successResponse);
      res.json(successResponse);
    } catch (error) {
      console.error('Error getting random engagement message:', error);
      logError(`${ENDPOINT}/random`, error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get random engagement message'
      });
    }
  },
  
  // Respond to an engagement message
  respondToMessage: async (req, res) => {
    try {
      logRequest(`${ENDPOINT}/respond`, req);
      
      const userId = req.user._id;
      const { messageId, response } = req.body;
      
      if (!messageId || !response) {
        const errorResponse = {
          success: false,
          error: 'Both messageId and response are required'
        };
        logResponse(`${ENDPOINT}/respond`, errorResponse);
        return res.status(400).json(errorResponse);
      }
      
      // Find the original message
      const originalMessage = await EngagementMessage.findById(messageId);
      if (!originalMessage) {
        const errorResponse = {
          success: false,
          error: 'Engagement message not found'
        };
        logResponse(`${ENDPOINT}/respond`, errorResponse);
        return res.status(404).json(errorResponse);
      }
      
      // Create a new conversation ID for this interaction
      const conversationId = uuidv4();
      
      // Save the original message as a system message in the chat
      const systemMessage = new Chat({
        userId,
        conversationId,
        message: originalMessage.message,
        isAI: true,
        isEmbedded: false
      });
      await systemMessage.save();
      
      // Save the user's response
      const userMessage = new Chat({
        userId,
        conversationId,
        parentMessageId: systemMessage._id.toString(),
        message: response,
        isAI: false,
        isEmbedded: false
      });
      await userMessage.save();
      
      // Process embeddings in the background
      setTimeout(() => {
        // Process embedding for system message
        processMessageEmbedding(
          userId.toString(),
          conversationId,
          systemMessage._id.toString(),
          originalMessage.message,
          true
        )
          .then(success => {
            if (success) {
              console.log(`Successfully processed embedding for system message ${systemMessage._id}`);
              Chat.findByIdAndUpdate(systemMessage._id, { isEmbedded: true })
                .catch(err => console.error(`Error updating isEmbedded flag for message ${systemMessage._id}:`, err));
            }
          })
          .catch(err => console.error(`Error processing system message embedding for ${systemMessage._id}:`, err));
        
        // Process embedding for user response
        processMessageEmbedding(
          userId.toString(),
          conversationId,
          userMessage._id.toString(),
          response,
          false
        )
          .then(success => {
            if (success) {
              console.log(`Successfully processed embedding for user message ${userMessage._id}`);
              Chat.findByIdAndUpdate(userMessage._id, { isEmbedded: true })
                .catch(err => console.error(`Error updating isEmbedded flag for message ${userMessage._id}:`, err));
            }
          })
          .catch(err => console.error(`Error processing user message embedding for ${userMessage._id}:`, err));
      }, 100);
      
      const successResponse = {
        success: true,
        data: {
          conversationId,
          systemMessageId: systemMessage._id,
          userMessageId: userMessage._id
        }
      };
      
      logResponse(`${ENDPOINT}/respond`, successResponse);
      res.json(successResponse);
    } catch (error) {
      console.error('Error responding to engagement message:', error);
      logError(`${ENDPOINT}/respond`, error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process response'
      });
    }
  },
  
  // Admin: Create a new engagement message
  createMessage: async (req, res) => {
    try {
      logRequest(`${ENDPOINT}/create`, req);
      
      const { category, message } = req.body;
      
      if (!category || !message) {
        const errorResponse = {
          success: false,
          error: 'Both category and message are required'
        };
        logResponse(`${ENDPOINT}/create`, errorResponse);
        return res.status(400).json(errorResponse);
      }
      
      const newMessage = new EngagementMessage({
        category,
        message
      });
      
      await newMessage.save();
      
      const successResponse = {
        success: true,
        data: {
          id: newMessage._id,
          category: newMessage.category,
          message: newMessage.message,
          isActive: newMessage.isActive,
          createdAt: newMessage.createdAt
        }
      };
      
      logResponse(`${ENDPOINT}/create`, successResponse);
      res.status(201).json(successResponse);
    } catch (error) {
      console.error('Error creating engagement message:', error);
      logError(`${ENDPOINT}/create`, error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create engagement message'
      });
    }
  },
  
  // Admin: Get all engagement messages
  getAllMessages: async (req, res) => {
    try {
      logRequest(`${ENDPOINT}/all`, req);
      
      const { category } = req.query;
      
      // Build query
      const query = {};
      if (category) {
        query.category = category;
      }
      
      const messages = await EngagementMessage.find(query).sort({ category: 1, createdAt: -1 });
      
      const successResponse = {
        success: true,
        data: {
          count: messages.length,
          messages: messages.map(msg => ({
            id: msg._id,
            category: msg.category,
            message: msg.message,
            isActive: msg.isActive,
            createdAt: msg.createdAt
          }))
        }
      };
      
      logResponse(`${ENDPOINT}/all`, successResponse);
      res.json(successResponse);
    } catch (error) {
      console.error('Error getting all engagement messages:', error);
      logError(`${ENDPOINT}/all`, error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get engagement messages'
      });
    }
  },
  
  // Admin: Update an engagement message
  updateMessage: async (req, res) => {
    try {
      logRequest(`${ENDPOINT}/update`, req);
      
      const { id } = req.params;
      const { category, message, isActive } = req.body;
      
      if (!id) {
        const errorResponse = {
          success: false,
          error: 'Message ID is required'
        };
        logResponse(`${ENDPOINT}/update`, errorResponse);
        return res.status(400).json(errorResponse);
      }
      
      // Build update object
      const updateData = {};
      if (category) updateData.category = category;
      if (message) updateData.message = message;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const updatedMessage = await EngagementMessage.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );
      
      if (!updatedMessage) {
        const errorResponse = {
          success: false,
          error: 'Engagement message not found'
        };
        logResponse(`${ENDPOINT}/update`, errorResponse);
        return res.status(404).json(errorResponse);
      }
      
      const successResponse = {
        success: true,
        data: {
          id: updatedMessage._id,
          category: updatedMessage.category,
          message: updatedMessage.message,
          isActive: updatedMessage.isActive,
          updatedAt: updatedMessage.updatedAt
        }
      };
      
      logResponse(`${ENDPOINT}/update`, successResponse);
      res.json(successResponse);
    } catch (error) {
      console.error('Error updating engagement message:', error);
      logError(`${ENDPOINT}/update`, error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update engagement message'
      });
    }
  },
  
  // Admin: Delete an engagement message
  deleteMessage: async (req, res) => {
    try {
      logRequest(`${ENDPOINT}/delete`, req);
      
      const { id } = req.params;
      
      if (!id) {
        const errorResponse = {
          success: false,
          error: 'Message ID is required'
        };
        logResponse(`${ENDPOINT}/delete`, errorResponse);
        return res.status(400).json(errorResponse);
      }
      
      const deletedMessage = await EngagementMessage.findByIdAndDelete(id);
      
      if (!deletedMessage) {
        const errorResponse = {
          success: false,
          error: 'Engagement message not found'
        };
        logResponse(`${ENDPOINT}/delete`, errorResponse);
        return res.status(404).json(errorResponse);
      }
      
      const successResponse = {
        success: true,
        data: {
          id: deletedMessage._id,
          message: 'Engagement message deleted successfully'
        }
      };
      
      logResponse(`${ENDPOINT}/delete`, successResponse);
      res.json(successResponse);
    } catch (error) {
      console.error('Error deleting engagement message:', error);
      logError(`${ENDPOINT}/delete`, error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete engagement message'
      });
    }
  }
};

module.exports = engagementController;