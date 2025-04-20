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


      let prompt = "You are a nutrition and exercise coach. Your entire response must be in 2-3 short paragraphs with no special characters. Never use asterisks, bullet points, dashes or any symbols. Do not format text in any way. Keep total response under 100 words. Provide only the most essential advice in plain conversational sentences. Answer the user's question directly in brief paragraphs.";

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
      let aiResponse = geminiResponse.data.candidates[0].content.parts[0].text;
      
      // Clean up the response - remove any special characters or formatting
      aiResponse = aiResponse
        .replace(/\*/g, '') // Remove asterisks
        .replace(/\n+/g, ' ') // Replace multiple newlines with a single space
        .replace(/\s{2,}/g, ' ') // Replace multiple spaces with a single space
        .replace(/^[^a-zA-Z0-9]+/, '') // Remove non-alphanumeric characters at the start
        .replace(/[^\w\s.,!?:]/g, '') // Remove any remaining special characters except basic punctuation
        .trim(); // Trim whitespace
      
      // Make sure the response starts with "Coach:" if it doesn't already
      if (!aiResponse.startsWith('Coach:')) {
        aiResponse = 'Coach: ' + aiResponse;
      }
      
      // Enforce character limit (approximately 150 characters for 2-3 short sentences)
      if (aiResponse.length > 150) {
        // Find the last sentence end within the limit
        const lastSentenceEnd = aiResponse.substring(0, 150).lastIndexOf('.');
        if (lastSentenceEnd > 50) {
          aiResponse = aiResponse.substring(0, lastSentenceEnd + 1);
        } else {
          // If no sentence end found, just truncate
          aiResponse = aiResponse.substring(0, 150);
        }
      }
      
      console.log(`AI response: "${aiResponse}"`);

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