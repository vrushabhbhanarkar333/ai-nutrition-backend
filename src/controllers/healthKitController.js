const healthKitService = require('../services/healthKitService');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');

const ENDPOINT = 'healthKitController';

const healthKitController = {
  // Sync HealthKit data
  syncHealthKitData: async (req, res) => {
    try {
      const { userId } = req.user;
      const healthKitData = req.body;

      logRequest(`${ENDPOINT}.syncHealthKitData`, {
        userId,
        dataType: Object.keys(healthKitData)
      });

      // Store the HealthKit data
      const result = await healthKitService.storeHealthKitData(userId, healthKitData);

      logResponse(`${ENDPOINT}.syncHealthKitData`, {
        success: true,
        dataId: result._id
      });

      res.json({
        success: true,
        message: 'HealthKit data synchronized successfully',
        data: result
      });
    } catch (error) {
      logError(`${ENDPOINT}.syncHealthKitData`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to synchronize HealthKit data',
        error: error.message
      });
    }
  },

  // Get HealthKit data for a date range
  getHealthKitData: async (req, res) => {
    try {
      const { userId } = req.user;
      const { startDate, endDate } = req.query;

      logRequest(`${ENDPOINT}.getHealthKitData`, {
        userId,
        startDate,
        endDate
      });

      const data = await healthKitService.getHealthKitDataForRange(
        userId,
        new Date(startDate),
        new Date(endDate)
      );

      logResponse(`${ENDPOINT}.getHealthKitData`, {
        count: data.length
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logError(`${ENDPOINT}.getHealthKitData`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch HealthKit data',
        error: error.message
      });
    }
  },

  // Get latest HealthKit data
  getLatestHealthKitData: async (req, res) => {
    try {
      const { userId } = req.user;

      logRequest(`${ENDPOINT}.getLatestHealthKitData`, { userId });

      const data = await healthKitService.getLatestHealthKitData(userId);

      logResponse(`${ENDPOINT}.getLatestHealthKitData`, {
        found: !!data
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logError(`${ENDPOINT}.getLatestHealthKitData`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch latest HealthKit data',
        error: error.message
      });
    }
  },

  // Get aggregated HealthKit data
  getAggregatedHealthKitData: async (req, res) => {
    try {
      const { userId } = req.user;
      const { days = 7 } = req.query;

      logRequest(`${ENDPOINT}.getAggregatedHealthKitData`, {
        userId,
        days
      });

      const data = await healthKitService.getAggregatedHealthKitData(userId, parseInt(days));

      logResponse(`${ENDPOINT}.getAggregatedHealthKitData`, {
        found: !!data
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logError(`${ENDPOINT}.getAggregatedHealthKitData`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch aggregated HealthKit data',
        error: error.message
      });
    }
  }
};

module.exports = healthKitController; 