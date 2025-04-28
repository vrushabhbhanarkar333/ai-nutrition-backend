const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Replace with your actual API URL and auth token
const API_URL = 'http://localhost:3000/api'; // Default port is 3000 as seen in server.js
const authToken = 'YOUR_AUTH_TOKEN'; // Replace with a valid token

// Configuration
const config = {
  headers: {
    'Authorization': `Bearer ${authToken}`
  }
};

// Note: Simple AI Chat test has been removed as we've consolidated to a single chat system

// 1. Test Chat - Send Text Message
async function testChatText() {
  try {
    console.log('\n=== Testing Chat - Text Message ===\n');
    
    const formData = new FormData();
    formData.append('message', 'How many calories should I eat daily if I want to lose weight?');
    
    const response = await axios.post(`${API_URL}/chat/message`, formData, {
      ...config,
      headers: {
        ...config.headers,
        ...formData.getHeaders()
      }
    });
    
    console.log('Chat Text Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Return conversation ID for future use
    return response.data.data.conversationId;
  } catch (error) {
    console.error('Chat Text failed:', error.response?.data || error.message);
    return null;
  }
}

// 2. Test Chat - Continue Conversation
async function testChatContinue(conversationId) {
  if (!conversationId) {
    console.error('Cannot continue conversation: No conversation ID provided');
    return null;
  }
  
  try {
    console.log('\n=== Testing Chat - Continue Conversation ===\n');
    
    const formData = new FormData();
    formData.append('message', 'What about exercise? How much should I do?');
    formData.append('conversationId', conversationId);
    
    const response = await axios.post(`${API_URL}/chat/message`, formData, {
      ...config,
      headers: {
        ...config.headers,
        ...formData.getHeaders()
      }
    });
    
    console.log('Chat Continue Response:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Chat Continue failed:', error.response?.data || error.message);
    return null;
  }
}

// 3. Test Chat - Send Image
async function testChatImage() {
  try {
    console.log('\n=== Testing Chat - Image Analysis ===\n');
    
    // Check if test image exists, if not, inform user
    const imagePath = path.join(__dirname, 'test-meal.jpg');
    if (!fs.existsSync(imagePath)) {
      console.log('Test image not found. Please add a test image named "test-meal.jpg" to the project root.');
      console.log('Skipping image test...');
      return null;
    }
    
    const formData = new FormData();
    formData.append('message', 'What does this meal contain and is it healthy?');
    formData.append('image', fs.createReadStream(imagePath));
    
    const response = await axios.post(`${API_URL}/chat/message`, formData, {
      ...config,
      headers: {
        ...config.headers,
        ...formData.getHeaders()
      }
    });
    
    console.log('Chat Image Response:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data.data.conversationId;
  } catch (error) {
    console.error('Advanced Chat Image failed:', error.response?.data || error.message);
    return null;
  }
}

// 5. Test Get Chat History
async function testGetChatHistory(conversationId) {
  try {
    console.log('\n=== Testing Get Chat History ===\n');
    
    let url = `${API_URL}/chat/history`;
    if (conversationId) {
      url += `?conversationId=${conversationId}`;
      console.log(`Getting history for conversation: ${conversationId}`);
    } else {
      console.log('Getting all conversation history');
    }
    
    const response = await axios.get(url, config);
    
    console.log('Chat History Response:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Get Chat History failed:', error.response?.data || error.message);
    return null;
  }
}

// 6. Test Delete Conversation
async function testDeleteConversation(conversationId) {
  if (!conversationId) {
    console.error('Cannot delete conversation: No conversation ID provided');
    return null;
  }
  
  try {
    console.log('\n=== Testing Delete Conversation ===\n');
    console.log(`Deleting conversation: ${conversationId}`);
    
    const response = await axios.delete(`${API_URL}/chat/conversation/${conversationId}`, config);
    
    console.log('Delete Conversation Response:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Delete Conversation failed:', error.response?.data || error.message);
    return null;
  }
}

// Run all tests in sequence
async function runAllTests() {
  console.log('Starting AI Chat API Tests');
  console.log('=========================');
  console.log('NOTE: Replace YOUR_AUTH_TOKEN in the script with a valid token before running');
  console.log('=========================\n');
  
  // Test 1: Chat - Text Message
  const conversationId = await testAdvancedChatText();
  
  // Test 3: Advanced Chat - Continue Conversation (if Test 2 succeeded)
  if (conversationId) {
    await testAdvancedChatContinue(conversationId);
  }
  
  // Test 4: Advanced Chat - Image Analysis
  const imageConversationId = await testAdvancedChatImage();
  
  // Test 5: Get Chat History (for specific conversation if Test 2 succeeded)
  if (conversationId) {
    await testGetChatHistory(conversationId);
  } else {
    // Get all history
    await testGetChatHistory();
  }
  
  // Test 6: Delete Conversation (if Test 2 succeeded)
  if (conversationId) {
    await testDeleteConversation(conversationId);
  }
  
  console.log('\n=========================');
  console.log('AI Chat API Tests Completed');
  console.log('=========================');
}

// Run the tests
runAllTests();