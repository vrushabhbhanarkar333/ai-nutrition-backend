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
  request_timeout: 40000, // Increase timeout to 30 seconds
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

      // Create vector table with enhanced metadata
      await client.query({
        query: `
          CREATE TABLE IF NOT EXISTS chat_embeddings (
            id UUID DEFAULT generateUUIDv4(),
            user_id String,
            conversation_id String,
            message_id String,
            message String,
            is_ai UInt8,
            embedding Array(Float32),
            timestamp DateTime64(3) DEFAULT now64(3),
            metadata Map(String, String),
            context Map(String, String),
            parent_message_id Nullable(String),
            response_to_message_id Nullable(String),
            message_type String DEFAULT 'chat',
            sentiment Float32 DEFAULT 0.0,
            topic String DEFAULT '',
            keywords Array(String) DEFAULT [],
            language String DEFAULT 'en'
          ) ENGINE = MergeTree()
          ORDER BY (user_id, conversation_id, timestamp)
        `,
      });

      console.log("Table 'chat_embeddings' created successfully.");
    } else {
      console.log("Table 'chat_embeddings' already exists.");

      // Add new columns if they don't exist
      try {
        await client.query({
          query: `
            ALTER TABLE chat_embeddings
            ADD COLUMN IF NOT EXISTS metadata Map(String, String),
            ADD COLUMN IF NOT EXISTS context Map(String, String),
            ADD COLUMN IF NOT EXISTS parent_message_id Nullable(String),
            ADD COLUMN IF NOT EXISTS response_to_message_id Nullable(String),
            ADD COLUMN IF NOT EXISTS message_type String DEFAULT 'chat',
            ADD COLUMN IF NOT EXISTS sentiment Float32 DEFAULT 0.0,
            ADD COLUMN IF NOT EXISTS topic String DEFAULT '',
            ADD COLUMN IF NOT EXISTS keywords Array(String) DEFAULT [],
            ADD COLUMN IF NOT EXISTS language String DEFAULT 'en'
          `
        });
        console.log("Added new columns to chat_embeddings table.");
      } catch (alterError) {
        console.error("Error adding new columns:", alterError);
      }
    }

    // Test the table with a sample insert
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
          timestamp: new Date(),
          metadata: {'type': 'test', 'source': 'initialization'},
          context: {'conversation_type': 'test', 'environment': 'development'},
          message_type: 'test',
          sentiment: 0.5,
          topic: 'testing',
          keywords: ['test', 'initialization'],
          language: 'en'
        }],
        format: 'JSONEachRow'
      });

      console.log("Test insert successful.");
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

// Store a message embedding in ClickHouse with enhanced metadata
const storeEmbedding = async (userId, conversationId, messageId, message, isAi, embedding, metadata = {}, context = {}) => {
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
      embeddingDimensions: embedding.length,
      metadata,
      context
    });

    // Truncate message if too long for ClickHouse
    const truncatedMessage = message.length > 10000 ? message.substring(0, 10000) : message;

    // Prepare the data with enhanced metadata
    const data = {
      user_id: userId,
      conversation_id: conversationId || '',
      message_id: messageId,
      message: truncatedMessage,
      is_ai: isAi ? 1 : 0,
      embedding: embedding,
      timestamp: new Date().toISOString(),
      metadata: metadata,
      context: context,
      message_type: metadata.message_type || 'chat',
      sentiment: metadata.sentiment || 0.0,
      topic: metadata.topic || '',
      keywords: metadata.keywords || [],
      language: metadata.language || 'en'
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

    // Check if this is a query about previous notification questions
    const isAskingAboutNotifications = queryText.toLowerCase().includes('last question') ||
                                     queryText.toLowerCase().includes('previous question') ||
                                     queryText.toLowerCase().includes('notification question');

    // Use ClickHouse's cosineDistance function to find similar messages
    let query = `
      SELECT
        message_id,
        message,
        is_ai,
        conversation_id,
        metadata,
        1 - cosineDistance(embedding, [${queryEmbedding}]) AS similarity
      FROM chat_embeddings
      WHERE user_id = '${userId}'
    `;

    // If asking about notifications, prioritize notification questions
    if (isAskingAboutNotifications) {
      query += `
        AND metadata['isNotificationQuestion'] = 'true'
        ORDER BY similarity DESC, timestamp DESC
        LIMIT ${limit}
      `;
    } else {
      query += `
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;
    }

    const result = await client.query({
      query,
      format: 'JSONEachRow'
    });

    const similarMessages = await result.json();

    logResponse(`${ENDPOINT_SERVICE}.findSimilarMessages`, {
      count: similarMessages.length,
      topSimilarity: similarMessages.length > 0 ? similarMessages[0].similarity : null,
      isAskingAboutNotifications
    });

    return similarMessages;
  } catch (error) {
    logError(`${ENDPOINT_SERVICE}.findSimilarMessages`, error);
    console.error("Error finding similar messages:", error);
    return [];
  }
};

// Process a new chat message to generate and store its embedding
const processMessageEmbedding = async (userId, conversationId, messageId, message, isAi, metadata = {}, context = {}) => {
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

    // Store embedding with metadata and context
    await storeEmbedding(userId, conversationId, messageId, truncatedMessage, isAi, embedding, metadata, context);

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