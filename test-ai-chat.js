const axios = require('axios');

// Replace with your actual API URL and auth token
const API_URL = 'http://localhost:5000/api';
const authToken = 'YOUR_AUTH_TOKEN'; // Replace with a valid token

// Test AI conversation
async function testAIConversation() {
  try {
    const response = await axios.post(`${API_URL}/ai/chat`, {
      message: "What are good sources of protein for vegetarians?",
      context: []
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('AI conversation response:');
    console.log(response.data);
  } catch (error) {
    console.error('AI conversation failed:', error.response?.data || error.message);
  }
}

// Run the test
testAIConversation();