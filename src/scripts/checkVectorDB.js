require('dotenv').config();
const { createClient } = require('@clickhouse/client');

// Initialize ClickHouse client
const client = createClient({
  url: 'https://jxp4673roi.westus3.azure.clickhouse.cloud:8443',
  username: 'default',
  password: '53mmu~hQwIZCY',
  request_timeout: 40000,
});

async function main() {
  try {
    console.log('Checking ClickHouse connection...');
    
    // Test connection
    const pingResult = await client.ping();
    console.log('ClickHouse connection:', pingResult.success ? 'Success' : 'Failed');
    
    // Check tables
    console.log('\nChecking tables...');
    const tables = await client.query({
      query: `
        SELECT name, engine
        FROM system.tables
        WHERE database = currentDatabase()
      `,
      format: 'JSONEachRow'
    });
    
    const tablesResult = await tables.json();
    console.log('Tables in database:');
    tablesResult.forEach(table => {
      console.log(`- ${table.name} (${table.engine})`);
    });
    
    // Check chat_history table
    console.log('\nChecking chat_history table...');
    try {
      const chatHistoryCount = await client.query({
        query: 'SELECT COUNT(*) as count FROM chat_history',
        format: 'JSONEachRow'
      });
      
      const chatHistoryResult = await chatHistoryCount.json();
      console.log(`chat_history records: ${chatHistoryResult[0].count}`);
      
      if (chatHistoryResult[0].count > 0) {
        const chatHistorySample = await client.query({
          query: 'SELECT * FROM chat_history LIMIT 1',
          format: 'JSONEachRow'
        });
        
        const chatHistorySampleResult = await chatHistorySample.json();
        console.log('Sample record:', JSON.stringify(chatHistorySampleResult[0], null, 2));
      }
    } catch (error) {
      console.error('Error checking chat_history table:', error.message);
    }
    
    // Check chat_embeddings table
    console.log('\nChecking chat_embeddings table...');
    try {
      const chatEmbeddingsCount = await client.query({
        query: 'SELECT COUNT(*) as count FROM chat_embeddings',
        format: 'JSONEachRow'
      });
      
      const chatEmbeddingsResult = await chatEmbeddingsCount.json();
      console.log(`chat_embeddings records: ${chatEmbeddingsResult[0].count}`);
      
      if (chatEmbeddingsResult[0].count > 0) {
        const chatEmbeddingsSample = await client.query({
          query: 'SELECT user_id, conversation_id, message_id, message, is_ai, timestamp FROM chat_embeddings LIMIT 1',
          format: 'JSONEachRow'
        });
        
        const chatEmbeddingsSampleResult = await chatEmbeddingsSample.json();
        console.log('Sample record (without embedding vector):', JSON.stringify(chatEmbeddingsSampleResult[0], null, 2));
        
        // Check embedding dimensions
        const embeddingDimensions = await client.query({
          query: 'SELECT length(embedding) as dimensions FROM chat_embeddings LIMIT 1',
          format: 'JSONEachRow'
        });
        
        const embeddingDimensionsResult = await embeddingDimensions.json();
        if (embeddingDimensionsResult.length > 0) {
          console.log(`Embedding dimensions: ${embeddingDimensionsResult[0].dimensions}`);
        }
      }
    } catch (error) {
      console.error('Error checking chat_embeddings table:', error.message);
    }
    
    console.log('\nVector database check completed.');
    process.exit(0);
  } catch (error) {
    console.error('Error checking vector database:', error);
    process.exit(1);
  }
}

// Run the script
main();