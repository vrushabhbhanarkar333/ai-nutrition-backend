const axios = require('axios');
const apiConfig = require('../config/api');

const aiConversationController = {
  // Handle AI conversation
  conversationChat: async (req, res) => {
    try {
      const { message, context } = req.body;
      const userId = req.user._id;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      console.log(`Processing AI conversation for user ${userId}: "${message}"`);

      // Prepare the prompt with nutrition context
      let prompt = "You are a nutrition and health assistant. Provide helpful, accurate, and detailed information about nutrition, health, fitness, and wellness. Provide helpful, accurate, and detailed information about nutrition, health, fitness, and wellness. Provide helpful, accurate, and detailed information about nutrition, health, fitness, and wellness. ";
      
      // Add context if provided
      if (context && context.length > 0) {
        prompt += "Based on our previous conversation: " + context.join(" ") + ". ";
      }
      
      // Add the user's message
      prompt += `User question: ${message}`;

      // Call Gemini API for conversation
      console.log('Calling Gemini API for conversation...');
      const geminiResponse = await axios.post(
        `${apiConfig.gemini.endpoint}?key=${apiConfig.gemini.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        }
      );

      console.log('Gemini API response received');

      if (!geminiResponse.data.candidates || !geminiResponse.data.candidates[0]) {
        throw new Error('No response generated from AI');
      }

      // Extract AI response
      const aiResponse = geminiResponse.data.candidates[0].content.parts[0].text;
      console.log(`AI response: "${aiResponse.substring(0, 100)}..."`);

      res.json({
        success: true,
        data: {
          message: aiResponse,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error in AI conversation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process AI conversation'
      });
    }
  }
};

module.exports = aiConversationController;