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
  // Initialize vector database
  initializeVectorDatabase: async (req, res) => {
    try {
      console.log('Manually initializing vector database...');
      
      // Initialize vector database
      const { initializeVectorTable } = require('../services/embeddingService');
      await initializeVectorTable();
      
      return res.status(200).json({
        success: true,
        message: 'Vector database initialized successfully'
      });
    } catch (error) {
      console.error('Error initializing vector database:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize vector database: ' + error.message
      });
    }
  },
  
  // Handle AI conversation
  conversationChat: async (req, res) => {
    try {
      // Debug: Log request
      logRequest(ENDPOINT, req);
      
      const { message, context } = req.body;
      const userId = req.user._id;
      const imageFile = req.file;

      console.log('\n==== CHAT MESSAGE REQUEST ====');
      console.log('Request body:', req.body);
      console.log('Request file:', imageFile ? {
        filename: imageFile.filename,
        mimetype: imageFile.mimetype,
        size: imageFile.size
      } : 'No file uploaded');
      console.log('User:', { id: userId });
      console.log('============================\n');

      if (!message) {
        const errorResponse = {
          success: false,
          error: 'Message is required',
        };
        logResponse(ENDPOINT, errorResponse);
        return res.status(400).json(errorResponse);
      }

      console.log(`Processing AI conversation for user ${userId}: "${message}"`);

      // Analyze message to determine the type of query
      const messageLower = message.toLowerCase();
      const isMealRelated = messageLower.includes('meal') || messageLower.includes('food') || 
                           messageLower.includes('eat') || messageLower.includes('diet') || 
                           messageLower.includes('calorie') || messageLower.includes('nutrition');
      
      const isProfileRelated = messageLower.includes('profile') || messageLower.includes('weight') || 
                              messageLower.includes('height') || messageLower.includes('age') || 
                              messageLower.includes('goal');
      
      const isStepRelated = messageLower.includes('step') || messageLower.includes('walk') || 
                           messageLower.includes('run') || messageLower.includes('activity');
      
      const isCalorieRelated = messageLower.includes('calorie') || messageLower.includes('intake') || 
                              messageLower.includes('burn') || messageLower.includes('deficit');
      
      console.log(`System prompt analysis: Meal: ${isMealRelated}, Profile: ${isProfileRelated}, Step: ${isStepRelated}, Calorie: ${isCalorieRelated}`);
      
      // Create a specialized system prompt based on the query type
      let systemPrompt = "You are a nutrition and exercise coach with the ability to analyze food images. When the user shares an image, analyze it in detail and incorporate your analysis into your response. When relevant information from the user's previous conversations is provided, reference it naturally in your response to personalize your advice. Your entire response must be in 2-3 short paragraphs with no special characters. Never use asterisks, bullet points, dashes or any symbols. Do not format text in any way. Keep total response under 500 words. Provide only the most essential advice in plain conversational sentences. Answer the user's question directly in brief paragraphs. IMPORTANT: Never tell the user you cannot see or analyze images - you have all the image analysis tools available and information is provided to you. When an image is shared, use the image analysis information provided to you.";
      
      // Add specialized instructions based on query type
      if (isMealRelated) {
        systemPrompt += " For meal and nutrition related questions, be specific about nutritional content, calorie information, and dietary recommendations. Reference any previous meal data from the user's history if available. Provide concrete meal suggestions when appropriate.";
      }
      
      if (isProfileRelated) {
        systemPrompt += " For profile-related questions, reference the user's specific profile information including weight, height, age, and goals. Tailor your advice to their specific profile characteristics and objectives.";
      }
      
      if (isStepRelated) {
        systemPrompt += " For step count and activity questions, provide specific information about their step count, activity levels, and progress toward goals. Compare current data with historical trends when available.";
      }
      
      if (isCalorieRelated) {
        systemPrompt += " For calorie-related questions, be precise about calorie intake, expenditure, and balance. Reference specific meal data and activity levels to provide accurate calorie information.";
      }
      
      // Create messages array for chat completions API
      const messages = [
        {
          role: "system",
          content: systemPrompt
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
            
            try {
              // If food analysis failed, fall back to Vision API
              const base64Image = imageBuffer.toString('base64');
              console.log(`Base64 image size: ${base64Image.length} characters`);
              
              // Debug: Log OpenAI Vision API call
              logRequest(`${ENDPOINT}/vision-api`, {
                model: "gpt-4o",
                imageSize: Math.round(base64Image.length / 1024) + 'KB'
              });

              console.log('Calling OpenAI Vision API...');
              // Get image description from OpenAI Vision API
              const visionResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: "You are now analyzing a food image. Describe what you see, identify the foods, estimate nutritional content, and suggest any health considerations. Be specific and thorough. Focus only on food items. Include estimated calories, protein, carbs, and fat content."
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
                max_tokens: 800
              });
              
              console.log('Vision API response received');
              // Debug: Log Vision API response
              logResponse(`${ENDPOINT}/vision-api`, {
                responseLength: visionResponse.choices[0].message.content.length,
                preview: visionResponse.choices[0].message.content.substring(0, 50) + '...',
                usage: visionResponse.usage
              });

              imageAnalysis = visionResponse.choices[0].message.content;
            } catch (visionError) {
              console.error('Error with Vision API:', visionError);
              throw new Error(`Failed to analyze image with Vision API: ${visionError.message}`);
            }
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
            content: `Error analyzing image: ${imageError.message}. Respond to the user's text query only, but DO NOT tell the user you cannot see or analyze images. Instead, ask them to describe the food they're asking about.`
          });
          
          messages.push({
            role: "assistant",
            content: "I notice you've shared an image. To provide the most accurate nutritional information, could you please describe what foods are in your image?"
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
        
        // Get similar messages with increased limit for better context
        const similarMessages = await findSimilarMessages(userId, message, 5);
        
        logResponse(`${ENDPOINT}/vector-search`, {
          count: similarMessages.length,
          messages: similarMessages.map(m => ({
            similarity: m.similarity,
            isAI: m.is_ai,
            preview: m.message.substring(0, 30) + '...',
            messageType: m.metadata?.message_type || 'unknown'
          }))
        });
        
        // If we found similar messages, add them as context
        if (similarMessages.length > 0) {
          // Group messages by type for better organization
          const mealMessages = similarMessages.filter(m => 
            m.metadata?.message_type === 'meal_data' || 
            m.metadata?.auto_detected_type === 'meal_data' ||
            m.message.toLowerCase().includes('meal') ||
            m.message.toLowerCase().includes('food') ||
            m.message.toLowerCase().includes('calorie')
          );
          
          const profileMessages = similarMessages.filter(m => 
            m.metadata?.message_type === 'user_profile' || 
            m.metadata?.auto_detected_type === 'user_profile' ||
            m.message.toLowerCase().includes('profile') ||
            m.message.toLowerCase().includes('weight') ||
            m.message.toLowerCase().includes('height')
          );
          
          const activityMessages = similarMessages.filter(m => 
            m.metadata?.message_type === 'healthkit_data' || 
            m.metadata?.auto_detected_type === 'healthkit_data' ||
            m.message.toLowerCase().includes('step') ||
            m.message.toLowerCase().includes('walk') ||
            m.message.toLowerCase().includes('activity')
          );
          
          const generalMessages = similarMessages.filter(m => 
            !mealMessages.includes(m) && 
            !profileMessages.includes(m) && 
            !activityMessages.includes(m)
          );
          
          console.log(`Grouped messages: Meal: ${mealMessages.length}, Profile: ${profileMessages.length}, Activity: ${activityMessages.length}, General: ${generalMessages.length}`);
          
          // Add a system message explaining the context
          messages.push({
            role: "system",
            content: "I found some relevant information from your previous conversations that might help with your current question:"
          });
          
          // Add meal-related messages if the query is about meals
          if (isMealRelated && mealMessages.length > 0) {
            messages.push({
              role: "system",
              content: "Here's your relevant meal and nutrition information:"
            });
            
            mealMessages.forEach(m => {
              messages.push({
                role: m.is_ai ? "assistant" : "user",
                content: m.message
              });
            });
          }
          
          // Add profile-related messages if the query is about profile
          if (isProfileRelated && profileMessages.length > 0) {
            messages.push({
              role: "system",
              content: "Here's your relevant profile information:"
            });
            
            profileMessages.forEach(m => {
              messages.push({
                role: m.is_ai ? "assistant" : "user",
                content: m.message
              });
            });
          }
          
          // Add activity-related messages if the query is about steps or activity
          if (isStepRelated && activityMessages.length > 0) {
            messages.push({
              role: "system",
              content: "Here's your relevant activity and step count information:"
            });
            
            activityMessages.forEach(m => {
              messages.push({
                role: m.is_ai ? "assistant" : "user",
                content: m.message
              });
            });
          }
          
          // Add general messages if we don't have specific category matches
          if ((mealMessages.length === 0 && profileMessages.length === 0 && activityMessages.length === 0) || 
              (!isMealRelated && !isProfileRelated && !isStepRelated && !isCalorieRelated)) {
            generalMessages.forEach(m => {
              messages.push({
                role: m.is_ai ? "assistant" : "user",
                content: m.message
              });
            });
          }
          
          // Add a separator
          messages.push({
            role: "system",
            content: "Now, let me address your current question specifically."
          });
        } else {
          console.log("No similar messages found in vector search");
          
          // If no similar messages found, add a note to the system to be more general
          messages.push({
            role: "system",
            content: "No specific previous context found for this query. Provide a general response based on the user's question."
          });
        }
      } catch (vectorError) {
        // Log error but continue without vector search results
        logError(`${ENDPOINT}/vector-search`, vectorError);
        console.error("Error in vector search:", vectorError);
        
        // Add a fallback instruction
        messages.push({
          role: "system",
          content: "Unable to retrieve vector search results. Provide a general response based on the user's question."
        });
      }
      
      // Add current user message, including reference to the image if one was uploaded
      if (imageFile) {
        // Need to format the user message with both text and image in the content array
        // when image is present, instead of adding it as a normal text message
        messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: message ? `${message} (I've also shared an image for you to analyze)` : "Please analyze this food image."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
              }
            }
          ]
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
        model: 'gpt-4o', 
        messages: messages.map(m => ({ 
          role: m.role, 
          content_preview: typeof m.content === 'string' 
            ? m.content.substring(0, 30) + '...' 
            : Array.isArray(m.content) 
              ? 'Content array with ' + m.content.length + ' items' 
              : 'Content is not a string or array'
        })),
        max_tokens: 500 
      });
      
      // Adjust parameters based on query type
      let temperature = 0.7;
      let maxTokens = 500;
      let presencePenalty = 0.0;
      let frequencyPenalty = 0.0;
      
      if (isMealRelated || isProfileRelated || isStepRelated) {
        // For data-specific queries, use lower temperature for more factual responses
        temperature = 0.5;
        maxTokens = 600; // Allow more tokens for detailed data responses
        presencePenalty = 0.3; // Encourage more diverse content
        frequencyPenalty = 0.3; // Reduce repetition
      }
      
      console.log(`Using OpenAI parameters: temperature=${temperature}, maxTokens=${maxTokens}, presencePenalty=${presencePenalty}, frequencyPenalty=${frequencyPenalty}`);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        presence_penalty: presencePenalty,
        frequency_penalty: frequencyPenalty,
        top_p: 0.95
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
        finalResponse = `Coach: Based on the food image you shared: ${imageAnalysis.substring(0, 200)}... 

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
