const OpenAI = require('openai');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');
const { findSimilarMessages } = require('../services/embeddingService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ENDPOINT = 'api/ai/chat';

const aiConversationController = {
  // Handle AI conversation
  conversationChat: async (req, res) => {
    try {
      // Debug: Log request
      logRequest(ENDPOINT, req);
      
      const { message, context } = req.body;
      const userId = req.user._id;

      if (!message) {
        const errorResponse = {
          success: false,
          error: 'Message is required',
        };
        logResponse(ENDPOINT, errorResponse);
        return res.status(400).json(errorResponse);
      }

      console.log(`Processing AI conversation for user ${userId}: "${message}"`);

      // Create messages array for chat completions API
      const messages = [
        {
          role: "system",
          content: "You are a nutrition and exercise coach. When relevant information from the user's previous conversations is provided, reference it naturally in your response to personalize your advice. Your entire response must be in 2-3 short paragraphs with no special characters. Never use asterisks, bullet points, dashes or any symbols. Do not format text in any way. Keep total response under 100 words. Provide only the most essential advice in plain conversational sentences. Answer the user's question directly in brief paragraphs."
        }
      ];

      // Add conversation context if available
      if (context && context.length > 0) {
        // Parse context into proper message format
        for (let i = 0; i < context.length; i++) {
          const contextItem = context[i];
          if (contextItem.startsWith('User:')) {
            messages.push({
              role: "user",
              content: contextItem.replace('User:', '').trim()
            });
          } else if (contextItem.startsWith('Coach:')) {
            messages.push({
              role: "assistant",
              content: contextItem.replace('Coach:', '').trim()
            });
          }
        }
      }

      // Find relevant previous messages using vector search
      try {
        logRequest(`${ENDPOINT}/vector-search`, {
          userId,
          messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        });
        
        const similarMessages = await findSimilarMessages(userId, message, 3);
        
        logResponse(`${ENDPOINT}/vector-search`, {
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
        logError(`${ENDPOINT}/vector-search`, vectorError);
      }
      
      // Add current user message
      messages.push({
        role: "user",
        content: message
      });

      console.log('Calling OpenAI API for conversation...');
      
      // Debug: Log OpenAI request
      logRequest(`${ENDPOINT}/openai`, { 
        model: 'gpt-4-turbo-preview', 
        messages: messages.map(m => ({ role: m.role, content_preview: m.content.substring(0, 30) + '...' })),
        max_tokens: 150 
      });
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
      });

      // Debug: Log OpenAI response (truncated for brevity)
      logResponse(`${ENDPOINT}/openai`, { 
        model: response.model,
        choices: response.choices.map(c => ({ 
          content: c.message.content.substring(0, 50) + '...',
          role: c.message.role 
        })),
        usage: response.usage
      });

      // Get the AI response and clean it
      let aiResponse = response.choices[0].message.content.trim();
      
      // Clean response of any markdown formatting
      aiResponse = aiResponse
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
        .replace(/^#+\s+/gm, '')         // Remove heading markers
        .replace(/^[-*+]\s+/gm, '')      // Remove bullet points
        .replace(/`([^`]+)`/g, '$1');    // Remove code formatting

      // Add Coach prefix if not present
      if (!aiResponse.startsWith('Coach:')) {
        aiResponse = 'Coach: ' + aiResponse;
      }

      console.log(`AI response: "${aiResponse}"`);

      const successResponse = {
        success: true,
        data: {
          message: aiResponse,
          timestamp: new Date().toISOString(),
        },
      };
      
      // Debug: Log response
      logResponse(ENDPOINT, successResponse);
      
      res.json(successResponse);
    } catch (error) {
      console.error('Error in AI conversation:', error);
      
      // Debug: Log error
      logError(ENDPOINT, error);
      
      const errorResponse = {
        success: false,
        error: error.message || 'Failed to process AI conversation',
      };
      
      res.status(500).json(errorResponse);
    }
  },
};

module.exports = aiConversationController;