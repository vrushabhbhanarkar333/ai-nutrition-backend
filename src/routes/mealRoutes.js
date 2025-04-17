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

// Get today's calorie count
router.get('/daily', mealController.getDailyCalories);

// Get meal history for a specific date
router.get('/history', mealController.getMealHistory);

module.exports = router; 