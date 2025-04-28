const OpenAI = require('openai');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');

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

      let prompt = "You are a nutrition and exercise coach. Your entire response must be in 2-3 short paragraphs with no special characters. Never use asterisks, bullet points, dashes or any symbols. Do not format text in any way. Keep total response under 100 words. Provide only the most essential advice in plain conversational sentences. Answer the user's question directly in brief paragraphs.";

      if (context && context.length > 0) {
        prompt += " Based on our previous conversation: " + context.join(" ") + ". ";
      }

      prompt += ` User question: ${message}`;

      console.log('Calling OpenAI API for conversation...');
      
      // Debug: Log OpenAI request
      logRequest(`${ENDPOINT}/openai`, { model: 'text-davinci-003', prompt, max_tokens: 150 });
      
      const response = await openai.completions.create({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 150,
      });

      // Debug: Log OpenAI response (truncated for brevity)
      logResponse(`${ENDPOINT}/openai`, { 
        model: response.model,
        choices: response.choices.map(c => ({ text: c.text.substring(0, 50) + '...' })),
        usage: response.usage
      });

      let aiResponse = response.choices[0].text.trim();

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