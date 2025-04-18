// Simple test script for the food API endpoints
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

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

// Test food analysis
async function testFoodAnalysis() {
  try {
    const imagePath = path.join(__dirname, '../../uploads/test-food.jpg');
    
    // Check if test image exists
    if (!fs.existsSync(imagePath)) {
      console.error('Test image not found:', imagePath);
      return;
    }
    
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));
    
    const response = await axios.post(`${API_URL}/food/analyze`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    
    console.log('Food analysis successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Food analysis failed:', error.response?.data || error.message);
  }
}

// Test adding analyzed food
async function testAddAnalyzedFood(analysisResult) {
  try {
    if (!analysisResult) {
      console.error('No analysis result to add');
      return;
    }
    
    const { foodItems, totalCalories } = analysisResult.data;
    
    // Determine meal type based on time of day
    const hour = new Date().getHours();
    let mealType = 'snack';
    if (hour >= 6 && hour < 10) mealType = 'breakfast';
    else if (hour >= 10 && hour < 14) mealType = 'lunch';
    else if (hour >= 17 && hour < 21) mealType = 'dinner';
    
    const response = await axios.post(`${API_URL}/food/add-analyzed`, {
      foodItems,
      totalCalories,
      mealType
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    console.log('Added analyzed food successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Adding analyzed food failed:', error.response?.data || error.message);
  }
}

// Test getting daily calories
async function testGetDailyCalories() {
  try {
    const response = await axios.get(`${API_URL}/food/daily-calories`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    console.log('Daily calories retrieved successfully:', response.data);
  } catch (error) {
    console.error('Getting daily calories failed:', error.response?.data || error.message);
  }
}

// Run tests
async function runTests() {
  await login();
  if (!authToken) {
    console.error('Cannot proceed without authentication');
    return;
  }
  
  const analysisResult = await testFoodAnalysis();
  await testAddAnalyzedFood(analysisResult);
  await testGetDailyCalories();
}

runTests();