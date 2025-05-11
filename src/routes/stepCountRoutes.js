const express = require('express');
const router = express.Router();
const stepCountController = require('../controllers/stepCountController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Force update step count
router.post('/force-update', stepCountController.forceUpdateStepCount);

// Verify step count
router.get('/verify/:date', stepCountController.verifyStepCount);

// Add or update step count
router.post('/', stepCountController.addStepCount);

// Get step count for a specific date
router.get('/', stepCountController.getStepCount);

// Get step count trend
router.get('/trend', stepCountController.getStepCountTrend);

// Get latest step count
router.get('/latest', stepCountController.getLatestStepCount);

module.exports = router; 