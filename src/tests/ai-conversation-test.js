// Simple test script for the AI conversation API endpoint
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let authToken = '';
let userId = '';

// Test user credentials
const testUser = {
  email: 'test@example.com',
  password: 'password123'
};

// Login to get auth token
async function login() {
  try {
    const response = await axios.post(`${API_URL}/users/login`, testUser);
    authToken = response.data.token;
    userId = response.data.user.id;
    console.log('Login successful, token obtained');
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
  }
}

// Test AI conversation
async function testAIConversation() {
  try {
    const response = await axios.post(`${API_URL}/ai/chat`, {
      message: "What are good sources of protein for vegetarians?",
      context: ["We were discussing vegetarian diets"]
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('AI conversation successful:');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('AI conversation failed:', error.response?.data || error.message);
  }
}

// Test nutrition question
async function testNutritionQuestion() {
  try {
    const response = await axios.post(`${API_URL}/ai/chat`, {
      message: "What are the health benefits of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados of avocados and how many calories do they contain?",
      context: [],
      context: [],
      context: [],
      context: [],
      context: [],
      context: [],
      context: [],
      context: [],
      context: [],
      context: [],
      context: [],
      context: [],
      context: [],
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Nutrition question successful:');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Nutrition question failed:', error.response?.data || error.message);
  }
}

// Run tests
async function runTests() {
  await login();
  if (!authToken) {
    console.error('Cannot proceed without authentication');
    return;
  }
  
  await testAIConversation();
  await testNutritionQuestion();
}

runTests();