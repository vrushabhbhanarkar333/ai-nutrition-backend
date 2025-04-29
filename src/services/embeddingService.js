const OpenAI = require('openai');
const { createClient } = require('@clickhouse/client');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize ClickHouse client
const client = createClient({
  url: 'https://jxp4673roi.westus3.azure.clickhouse.cloud:8443',
  username: 'default',
  password: '53mmu~hQwIZCY',
  request_timeout: 30000, // Increase timeout to 30 seconds
  compression: {
    request: true,
    response: true
  },
  clickhouse_settings: {
    wait_end_of_query: 1
  }
});

const ENDPOINT_SERVICE = 'embeddingService';

// Initialize vector table for embeddings
const initializeVectorTable = async () => {
  try {
    console.log("Initializing chat_embeddings table...");
    
    // First, check if the table exists
    const tableExists = await client.query({
      query: `
        SELECT name 
        FROM system.tables 
        WHERE database = currentDatabase() 
        AND name = 'chat_embeddings'
      `,
      format: 'JSONEachRow'
    });
    
    const tableExistsResult = await tableExists.json();
    
    // If table doesn't exist, create it
    if (tableExistsResult.length === 0) {
      console.log("Creating chat_embeddings table...");
      
      // Create vector table
      await client.query({
        query: `
          CREATE TABLE IF NOT EXISTS chat_embeddings (
            id UUID DEFAULT generateUUIDv4(),
            user_id String,
            conversation_id String,
            message_id String,
            message String,
            is_ai UInt8, -- Using UInt8 instead of Boolean for better compatibility
            embedding Array(Float32),
            timestamp DateTime64(3) DEFAULT now64(3)
          ) ENGINE = MergeTree()
          ORDER BY (user_id, conversation_id, timestamp)
        `,
      });
      
      console.log("Table 'chat_embeddings' created successfully.");
    } else {
      console.log("Table 'chat_embeddings' already exists.");
      
      // Verify table structure
      console.log("Verifying table structure...");
      const tableStructure = await client.query({
        query: `DESCRIBE TABLE chat_embeddings`,
        format: 'JSONEachRow'
      });
      
      const structure = await tableStructure.json();
      console.log("Table structure:", JSON.stringify(structure, null, 2));
    }
    
    // Test the table with a simple insert
    console.log("Testing chat_embeddings table with a sample insert...");
    try {
      await client.insert({
        table: 'chat_embeddings',
        values: [{
          user_id: 'test_user',
          conversation_id: 'test_conversation',
          message_id: 'test_message',
          message: 'This is a test message',
          is_ai: 0,
          embedding: [0.1, 0.2, 0.3],
          timestamp: new Date()
        }],
        format: 'JSONEachRow'
      });
      
      console.log("Test insert successful.");
      
      // Verify the test insert
      const testQuery = await client.query({
        query: `SELECT * FROM chat_embeddings WHERE message_id = 'test_message'`,
        format: 'JSONEachRow'
      });
      
      const testResult = await testQuery.json();
      console.log("Test query result:", testResult.length > 0 ? "Record found" : "No record found");
    } catch (testError) {
      console.error("Test insert failed:", testError);
    }
    
    console.log("Table 'chat_embeddings' initialization completed.");
  } catch (error) {
    console.error("Error initializing chat_embeddings table:", error);
    throw error;
  }
};

// Generate embedding for a text using OpenAI
const generateEmbedding = async (text) => {
  try {
    logRequest(`${ENDPOINT_SERVICE}.generateEmbedding`, {
      textLength: text.length,
      textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    });

    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    logResponse(`${ENDPOINT_SERVICE}.generateEmbedding`, {
      dimensions: response.data[0].embedding.length,
      usage: response.usage
    });

    return response.data[0].embedding;
  } catch (error) {
    logError(`${ENDPOINT_SERVICE}.generateEmbedding`, error);
    console.error("Error generating embedding:", error);
    throw error;
  }
};

// Store a message embedding in ClickHouse
const storeEmbedding = async (userId, conversationId, messageId, message, isAi, embedding) => {
  try {
    // Validate inputs
    if (!userId || !messageId || !message || !embedding || embedding.length === 0) {
      const error = new Error('Missing required parameters for storing embedding');
      logError(`${ENDPOINT_SERVICE}.storeEmbedding.validation`, {
        userId: !!userId,
        messageId: !!messageId,
        hasMessage: !!message,
        hasEmbedding: !!embedding,
        embeddingLength: embedding ? embedding.length : 0
      });
      throw error;
    }

    logRequest(`${ENDPOINT_SERVICE}.storeEmbedding`, {
      userId,
      conversationId,
      messageId,
      messageLength: message.length,
      isAi,
      embeddingDimensions: embedding.length
    });

    // Truncate message if too long for ClickHouse
    const truncatedMessage = message.length > 10000 ? message.substring(0, 10000) : message;

    // Prepare the data
    const data = {
      user_id: userId,
      conversation_id: conversationId || '',
      message_id: messageId,
      message: truncatedMessage,
      is_ai: isAi ? 1 : 0, // Ensure boolean is converted to 0/1
      embedding: embedding,
      timestamp: new Date().toISOString()
    };

    console.log(`Attempting to store embedding for message ${messageId}...`);
    
    // Insert the data
    const result = await client.insert({
      table: 'chat_embeddings',
      values: [data],
      format: 'JSONEachRow'
    });

    console.log(`Embedding stored successfully for message ${messageId}`);
    
    logResponse(`${ENDPOINT_SERVICE}.storeEmbedding`, {
      success: true,
      userId,
      conversationId,
      messageId,
      result: result || 'Success'
    });

  } catch (error) {
    logError(`${ENDPOINT_SERVICE}.storeEmbedding`, {
      error: error.message,
      stack: error.stack,
      userId,
      messageId
    });
    console.error(`Error storing embedding for message ${messageId}:`, error);
    // Don't throw the error, just log it to prevent breaking the chat flow
  }
};

// Find similar messages using vector search
const findSimilarMessages = async (userId, queryText, limit = 5) => {
  try {
    // Generate embedding for the query text
    const queryEmbedding = await generateEmbedding(queryText);
    
    logRequest(`${ENDPOINT_SERVICE}.findSimilarMessages`, {
      userId,
      queryTextLength: queryText.length,
      queryTextPreview: queryText.substring(0, 50) + (queryText.length > 50 ? '...' : ''),
      limit
    });

    // Use ClickHouse's cosineDistance function to find similar messages
    const query = `
      SELECT 
        message_id,
        message,
        is_ai,
        conversation_id,
        1 - cosineDistance(embedding, [${queryEmbedding}]) AS similarity
      FROM chat_embeddings
      WHERE user_id = '${userId}'
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    const result = await client.query({
      query,
      format: 'JSONEachRow'
    });

    const similarMessages = await result.json();

    logResponse(`${ENDPOINT_SERVICE}.findSimilarMessages`, {
      count: similarMessages.length,
      topSimilarity: similarMessages.length > 0 ? similarMessages[0].similarity : null
    });

    return similarMessages;
  } catch (error) {
    logError(`${ENDPOINT_SERVICE}.findSimilarMessages`, error);
    console.error("Error finding similar messages:", error);
    return [];
  }
};

// Process a new chat message to generate and store its embedding
const processMessageEmbedding = async (userId, conversationId, messageId, message, isAi) => {
  try {
    console.log(`Processing embedding for message ${messageId} (${isAi ? 'AI' : 'User'})...`);
    
    // Validate inputs
    if (!userId || !messageId || !message) {
      console.error('Missing required parameters for processing message embedding:', {
        hasUserId: !!userId,
        hasMessageId: !!messageId,
        hasMessage: !!message
      });
      return false;
    }
    
    // Truncate message if too long for embedding API
    const maxLength = 8000; // OpenAI has token limits
    const truncatedMessage = message.length > maxLength ? message.substring(0, maxLength) : message;
    
    // Generate embedding
    console.log(`Generating embedding for message ${messageId}...`);
    const embedding = await generateEmbedding(truncatedMessage);
    
    if (!embedding || embedding.length === 0) {
      console.error(`Failed to generate embedding for message ${messageId}`);
      return false;
    }
    
    console.log(`Successfully generated embedding with ${embedding.length} dimensions`);
    
    // Store embedding
    await storeEmbedding(userId, conversationId, messageId, truncatedMessage, isAi, embedding);
    
    console.log(`Completed embedding process for message ${messageId}`);
    return true;
  } catch (error) {
    console.error(`Error processing message embedding for ${messageId}:`, error);
    return false;
  }
};

module.exports = {
  initializeVectorTable,
  generateEmbedding,
  storeEmbedding,
  findSimilarMessages,
  processMessageEmbedding
};