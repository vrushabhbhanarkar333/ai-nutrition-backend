const stepCountService = require('../services/stepCountService');

const stepCountController = {
  // Force update step count
  forceUpdateStepCount: async (req, res) => {
    try {
      const { date, count } = req.body;
      const userId = req.user._id;

      console.log('Force updating step count:', { userId, date, count });

      const stepCount = await stepCountService.forceUpdateStepCount(userId, date, count);
      res.json(stepCount);
    } catch (error) {
      console.error('Error in forceUpdateStepCount:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Verify step count
  verifyStepCount: async (req, res) => {
    try {
      const { date } = req.params;
      const userId = req.user._id;

      console.log('Verifying step count:', { userId, date });

      const stepCount = await stepCountService.verifyStepCount(userId, date);
      res.json(stepCount);
    } catch (error) {
      console.error('Error in verifyStepCount:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Add or update step count
  addStepCount: async (req, res) => {
    try {
      const { date, count, forceUpdate } = req.body;
      const userId = req.user._id;

      console.log('Adding step count:', { userId, date, count, forceUpdate });

      // Validate input
      if (!date || typeof count !== 'number') {
        return res.status(400).json({ error: 'Invalid input parameters' });
      }

      const stepCount = await stepCountService.addStepCount(
        userId,
        date,
        count,
        forceUpdate || false
      );

      console.log('Step count added successfully:', stepCount);
      res.json(stepCount);
    } catch (error) {
      console.error('Error adding step count:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get step count for a specific date
  getStepCount: async (req, res) => {
    try {
      const { date } = req.query;
      const userId = req.user._id;

      console.log('Getting step count:', { userId, date });

      const stepCount = await stepCountService.getStepCount(userId, date || new Date());
      res.json(stepCount);
    } catch (error) {
      console.error('Error in getStepCount:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get step count trend
  getStepCountTrend: async (req, res) => {
    try {
      const userId = req.user._id;

      console.log('Getting step count trend for user:', userId);

      const trend = await stepCountService.getStepCountTrend(userId);
      res.json({ data: trend });
    } catch (error) {
      console.error('Error in getStepCountTrend:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get latest step count
  getLatestStepCount: async (req, res) => {
    try {
      const userId = req.user._id;

      console.log('Getting latest step count for user:', userId);

      const stepCount = await stepCountService.getLatestStepCount(userId);
      res.json(stepCount);
    } catch (error) {
      console.error('Error in getLatestStepCount:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = stepCountController; 