const HealthKitData = require('../models/HealthKitData');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');
const { processMessageEmbedding } = require('./embeddingService');

const ENDPOINT_SERVICE = 'healthKitService';

const healthKitService = {
  /**
   * Store HealthKit data in MongoDB and vector database
   * @param {string} userId - User ID
   * @param {Object} data - HealthKit data
   * @returns {Promise<Object>} Stored data
   */
  storeHealthKitData: async (userId, data) => {
    try {
      logRequest(`${ENDPOINT_SERVICE}.storeHealthKitData`, { userId, data });

      // Store step data in MongoDB
      const storedData = await HealthKitData.findOneAndUpdate(
        { userId, date: data.date },
        {
          $set: {
            steps: {
              count: data.steps.count,
              goal: data.steps.goal,
              progress: data.steps.progress
            },
            metadata: {
              source: 'Apple HealthKit',
              lastUpdated: new Date(),
              syncStatus: 'synced'
            }
          }
        },
        { upsert: true, new: true }
      );

      // Prepare step data summary for vector database
      const stepSummary = `Step Count Data for ${new Date(data.date).toLocaleDateString()}:
- Steps: ${data.steps.count}
- Daily Goal: ${data.steps.goal}
- Progress: ${Math.round(data.steps.progress)}%`;

      // Store step data in vector database
      await processMessageEmbedding(
        userId,
        null,
        `healthkit_${data.date}`,
        stepSummary,
        false,
        {
          message_type: 'healthkit_data',
          data_type: 'step_count',
          date: data.date,
          source: 'Apple HealthKit'
        },
        {
          user_id: userId,
          health_data: {
            steps: data.steps,
            date: data.date
          }
        }
      );

      logResponse(`${ENDPOINT_SERVICE}.storeHealthKitData`, { storedData });
      return storedData;
    } catch (error) {
      logError(`${ENDPOINT_SERVICE}.storeHealthKitData`, error);
      throw error;
    }
  },

  // Get HealthKit data for a date range
  getHealthKitDataForRange: async (userId, startDate, endDate) => {
    try {
      logRequest(`${ENDPOINT_SERVICE}.getHealthKitDataForRange`, {
        userId,
        startDate,
        endDate
      });

      const data = await HealthKitData.find({
        userId,
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ date: 1 });

      logResponse(`${ENDPOINT_SERVICE}.getHealthKitDataForRange`, {
        count: data.length,
        dateRange: `${startDate} to ${endDate}`
      });

      return data;
    } catch (error) {
      logError(`${ENDPOINT_SERVICE}.getHealthKitDataForRange`, error);
      throw error;
    }
  },

  // Get latest HealthKit data
  getLatestHealthKitData: async (userId) => {
    try {
      logRequest(`${ENDPOINT_SERVICE}.getLatestHealthKitData`, { userId });

      const data = await HealthKitData.findOne({ userId })
        .sort({ date: -1 })
        .limit(1);

      logResponse(`${ENDPOINT_SERVICE}.getLatestHealthKitData`, {
        found: !!data,
        date: data?.date
      });

      return data;
    } catch (error) {
      logError(`${ENDPOINT_SERVICE}.getLatestHealthKitData`, error);
      throw error;
    }
  },

  // Get aggregated HealthKit data for analysis
  getAggregatedHealthKitData: async (userId, days = 7) => {
    try {
      logRequest(`${ENDPOINT_SERVICE}.getAggregatedHealthKitData`, {
        userId,
        days
      });

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const data = await HealthKitData.aggregate([
        {
          $match: {
            userId: userId,
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            avgSteps: { $avg: '$steps.count' },
            totalSteps: { $sum: '$steps.count' },
            avgProgress: { $avg: '$steps.progress' }
          }
        }
      ]);

      logResponse(`${ENDPOINT_SERVICE}.getAggregatedHealthKitData`, {
        found: data.length > 0,
        metrics: data[0] ? Object.keys(data[0]) : []
      });

      return data[0] || null;
    } catch (error) {
      logError(`${ENDPOINT_SERVICE}.getAggregatedHealthKitData`, error);
      throw error;
    }
  }
};

module.exports = healthKitService; 