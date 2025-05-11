const express = require('express');
const router = express.Router();
const stepCountController = require('../controllers/stepCountController');
const auth = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// Add or update step count
router.post('/', stepCountController.addStepCount);

// Force update step count
router.post('/force-update', stepCountController.forceUpdateStepCount);

// Verify step count for a specific date
router.get('/verify/:date', stepCountController.verifyStepCount);

// Get step count for a specific date
router.get('/', stepCountController.getStepCount);

// Get step count trend for last 7 days
router.get('/trend', stepCountController.getStepCountTrend);

// Get latest step count
router.get('/latest', stepCountController.getLatestStepCount);

module.exports = router; 