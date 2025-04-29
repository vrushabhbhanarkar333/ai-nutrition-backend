const OpenAI = require('openai');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');
const { findSimilarMessages } = require('../services/embeddingService');
const foodService = require('../services/foodService');
const fs = require('fs');
const path = require('path');

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
      const imageFile = req.file;

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
          content: "You are a nutrition and exercise coach with the ability to analyze food images. When the user shares an image, analyze it in detail and incorporate your analysis into your response. When relevant information from the user's previous conversations is provided, reference it naturally in your response to personalize your advice. Your entire response must be in 2-3 short paragraphs with no special characters. Never use asterisks, bullet points, dashes or any symbols. Do not format text in any way. Keep total response under 300 words. Provide only the most essential advice in plain conversational sentences. Answer the user's question directly in brief paragraphs."
        }
      ];

      // Process image if provided
      let imageAnalysis = null;
      let foodAnalysisResult = null;
      if (imageFile) {
        console.log(`Image file detected: ${JSON.stringify({
          filename: imageFile.filename,
          path: imageFile.path,
          mimetype: imageFile.mimetype,
          size: imageFile.size
        })}`);
        
        try {
          // Debug: Log image processing
          logRequest(`${ENDPOINT}/image-analysis`, {
            imagePath: imageFile.path,
            filename: imageFile.filename,
            mimetype: imageFile.mimetype,
            size: imageFile.size
          });
          
          // Check if file exists
          if (!fs.existsSync(imageFile.path)) {
            console.error(`Image file does not exist at path: ${imageFile.path}`);
            throw new Error('Image file not found');
          }
          
          console.log(`Reading image file from: ${imageFile.path}`);
          const imageBuffer = fs.readFileSync(imageFile.path);
          console.log(`Image buffer size: ${imageBuffer.length} bytes`);
          
          // Use the food service to analyze the image
          console.log('Calling food service to analyze image...');
          foodAnalysisResult = await foodService.analyzeFood(imageBuffer);
          console.log('Food analysis result:', JSON.stringify(foodAnalysisResult));
          
          if (foodAnalysisResult.error) {
            console.log('Food analysis returned an error, falling back to vision API');
            
            // If food analysis failed, fall back to Vision API
            const base64Image = imageBuffer.toString('base64');
            console.log(`Base64 image size: ${base64Image.length} characters`);
            
            // Debug: Log OpenAI Vision API call
            logRequest(`${ENDPOINT}/vision-api`, {
              model: "gpt-4-vision-preview",
              imageSize: Math.round(base64Image.length / 1024) + 'KB'
            });

            console.log('Calling OpenAI Vision API...');
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
            
            console.log('Vision API response received');
            // Debug: Log Vision API response
            logResponse(`${ENDPOINT}/vision-api`, {
              responseLength: visionResponse.choices[0].message.content.length,
              preview: visionResponse.choices[0].message.content.substring(0, 50) + '...',
              usage: visionResponse.usage
            });

            imageAnalysis = visionResponse.choices[0].message.content;
          } else {
            // Format the food analysis result into a readable message
            const foodItems = foodAnalysisResult.foodItems;
            let analysisText = "I've analyzed your food image and identified the following items:\n\n";
            
            foodItems.forEach(item => {
              analysisText += `${item.name}: ${item.calories} calories per 100g. `;
              analysisText += `Contains ${item.protein}g protein, ${item.carbs}g carbs, ${item.fat}g fat, and ${item.fiber}g fiber. `;
              analysisText += `This food is generally considered ${item.isHealthy ? 'healthy' : 'less healthy'}.\n\n`;
            });
            
            analysisText += `Total estimated calories: ${foodAnalysisResult.totalCalories}`;
            
            imageAnalysis = analysisText;
          }
          
          console.log(`Image analysis: ${imageAnalysis.substring(0, 100)}...`);
          
          // Add image analysis to the conversation
          messages.push({
            role: "system",
            content: `I've analyzed the image the user shared. Here's what I can see: ${imageAnalysis}`
          });
          
          // Also add a direct message to the user about the image
          messages.push({
            role: "assistant",
            content: `I can see the image you've shared. ${imageAnalysis.substring(0, 150)}...`
          });
        } catch (imageError) {
          // Debug: Log image processing error
          console.error('Error processing image:', imageError);
          logError(`${ENDPOINT}/image-analysis`, imageError);
          
          // Continue without image analysis but with a more specific error message
          messages.push({
            role: "system",
            content: `Error analyzing image: ${imageError.message}. Respond to the user's text query only.`
          });
        }
      } else {
        console.log('No image file provided in the request');
      }

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
      
      // Add current user message, including reference to the image if one was uploaded
      if (imageFile) {
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

      console.log('Calling OpenAI API for conversation...');
      
      // Debug: Log OpenAI request
      logRequest(`${ENDPOINT}/openai`, { 
        model: 'gpt-4-turbo-preview', 
        messages: messages.map(m => ({ role: m.role, content_preview: m.content.substring(0, 30) + '...' })),
        max_tokens: 300 
      });
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: messages,
        max_tokens: 300,
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
      
      // If we have image analysis, make sure it's included in the response
      let finalResponse = aiResponse;
      if (imageAnalysis && !aiResponse.toLowerCase().includes('image')) {
        // The AI response doesn't mention the image, so we'll add the image analysis
        finalResponse = `Coach: I've analyzed the image you shared. ${imageAnalysis.substring(0, 150)}... 
        
${aiResponse.replace('Coach: ', '')}`;
      }

      const successResponse = {
        success: true,
        data: {
          message: finalResponse,
          hasImageAnalysis: !!imageAnalysis,
          foodAnalysis: foodAnalysisResult,
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