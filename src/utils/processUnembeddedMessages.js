const Chat = require('../models/Chat');
const { processMessageEmbedding } = require('../services/embeddingService');

/**
 * Process all unembedded messages in the database
 * This can be run periodically to ensure all messages have embeddings
 */
const processUnembeddedMessages = async () => {
  try {
    console.log('Starting to process unembedded messages...');
    
    // Find all messages that haven't been embedded yet
    const unembeddedMessages = await Chat.find({ isEmbedded: false })
      .sort({ createdAt: 1 })
      .limit(100) // Process in batches to avoid overwhelming the system
      .lean();
    
    console.log(`Found ${unembeddedMessages.length} unembedded messages to process`);
    
    if (unembeddedMessages.length === 0) {
      console.log('No unembedded messages found.');
      return;
    }
    
    // Process each message
    let successCount = 0;
    let failureCount = 0;
    
    for (const message of unembeddedMessages) {
      try {
        console.log(`Processing message ${message._id}...`);
        
        const success = await processMessageEmbedding(
          message.userId.toString(),
          message.conversationId,
          message._id.toString(),
          message.message,
          message.isAI
        );
        
        if (success) {
          // Update the message to mark it as embedded
          await Chat.findByIdAndUpdate(message._id, { isEmbedded: true });
          successCount++;
          console.log(`Successfully processed message ${message._id}`);
        } else {
          failureCount++;
          console.error(`Failed to process message ${message._id}`);
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        failureCount++;
        console.error(`Error processing message ${message._id}:`, error);
      }
    }
    
    console.log(`Completed processing unembedded messages. Success: ${successCount}, Failures: ${failureCount}`);
    
    return {
      total: unembeddedMessages.length,
      success: successCount,
      failure: failureCount
    };
  } catch (error) {
    console.error('Error in processUnembeddedMessages:', error);
    throw error;
  }
};

module.exports = processUnembeddedMessages;