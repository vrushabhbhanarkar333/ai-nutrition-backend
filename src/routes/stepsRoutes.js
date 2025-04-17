const express = require('express');
const router = express.Router();
const stepsController = require('../controllers/stepsController');
const authMiddleware = require('../middleware/authMiddleware');

// Protected routes
router.get('/', authMiddleware.authenticateToken, stepsController.getSteps);
router.put('/', authMiddleware.authenticateToken, stepsController.updateSteps);

module.exports = router; 