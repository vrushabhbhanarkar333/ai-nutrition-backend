const express = require('express');
const router = express.Router();
const mealController = require('../controllers/mealController');
const auth = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// Add a new meal
router.post('/', mealController.addMeal);

// Get recent meals (last 7 days)
router.get('/recent', mealController.getRecentMeals);

// Get today's calorie count or for a specific date if date parameter is provided
// Example: /api/meals/daily?date=2023-04-20
router.get('/daily', mealController.getDailyCalories);

// Get meal history for a specific date
// Example: /api/meals/history?date=2023-04-20
router.get('/history', mealController.getMealHistory);

// Get calories by date range (weekly overview)
// Example: /api/meals/range?startDate=2023-04-14&endDate=2023-04-20
router.get('/range', mealController.getCaloriesByDateRange);

module.exports = router; 