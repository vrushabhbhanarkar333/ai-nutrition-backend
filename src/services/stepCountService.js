const StepCount = require('../models/StepCount');
const { logRequest, logResponse, logError } = require('../utils/debugLogger');
const { storeStepCountEmbedding } = require('../services/embeddingService');

const stepCountService = {
  // Add or update step count for a user
  addStepCount: async (userId, date, count, forceUpdate = false) => {
    try {
      logRequest('addStepCount', { userId, date, count, forceUpdate });

      // Validate input
      if (!userId || !date || typeof count !== 'number') {
        throw new Error('Invalid input parameters');
      }

      // Normalize date to start of day in local timezone
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);

      // Validate step count
      if (count < 0) {
        throw new Error('Step count cannot be negative');
      }

      // Round to nearest integer
      count = Math.round(count);

      // Check for existing record
      const existingRecord = await StepCount.findOne({
        userId,
        date: normalizedDate
      });

      // If record exists and new count is not higher (and not forcing update), skip
      if (existingRecord && count <= existingRecord.count && !forceUpdate) {
        console.log('Skipping update - existing count is higher:', existingRecord.count);
        return existingRecord;
      }

      // Update or create step count record
      const stepCount = await StepCount.findOneAndUpdate(
        {
          userId,
          date: normalizedDate
        },
        {
          userId,
          date: normalizedDate,
          count,
          lastUpdated: new Date()
        },
        {
          new: true,
          upsert: true
        }
      );

      console.log('Step count saved:', stepCount);

      // Store in vector database
      await storeStepCountEmbedding(userId, {
        date: normalizedDate,
        count,
        forceUpdate: true // Always force update vector store
      });

      logResponse('addStepCount', stepCount);
      return stepCount;
    } catch (error) {
      logError('addStepCount', error);
      throw error;
    }
  },

  // Force update step count
  async forceUpdateStepCount(userId, date, count) {
    try {
      console.log('Force updating step count:', { userId, date, count });

      // Validate input
      if (!userId || !date || typeof count !== 'number' || isNaN(count) || count < 0) {
        throw new Error('Invalid input data');
      }

      // Normalize date to start of day in local timezone
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);

      // Round count to nearest integer
      const roundedCount = Math.round(count);

      console.log('Storing step count:', {
        userId,
        date: normalizedDate.toISOString(),
        count: roundedCount
      });

      // Update or create step count record
      const stepCount = await StepCount.findOneAndUpdate(
        { userId, date: normalizedDate },
        {
          count: roundedCount,
          lastUpdated: new Date(),
          source: 'healthkit'
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );

      console.log('Step count stored in database:', stepCount);

      // Store in vector database with enhanced metadata
      try {
        const vectorData = {
          userId: userId.toString(),
          date: normalizedDate.toISOString(),
          count: roundedCount,
          type: 'step_count',
          metadata: {
            source: 'healthkit',
            lastUpdated: new Date().toISOString(),
            forceUpdate: true,
            verified: true
          }
        };

        console.log('Storing in vector database:', vectorData);
        await storeStepCountEmbedding(userId, vectorData);
        console.log('Step count stored in vector database');

        // Verify the vector database update
        const verifyData = await StepCount.findOne({
          userId,
          date: normalizedDate
        });

        if (!verifyData || verifyData.count !== roundedCount) {
          console.error('Vector database verification failed:', {
            expected: roundedCount,
            actual: verifyData?.count
          });
          throw new Error('Vector database verification failed');
        }

        console.log('Vector database update verified successfully');
      } catch (error) {
        console.error('Error storing in vector database:', error);
        // Continue even if vector database update fails
      }

      return stepCount;
    } catch (error) {
      console.error('Error updating step count:', error);
      throw error;
    }
  },

  // Verify step count for a specific date
  verifyStepCount: async (userId, date) => {
    try {
      console.log('Verifying step count:', { userId, date });
      logRequest('verifyStepCount', { userId, date });
      
      // Ensure date is set to start of day in local timezone
      const inputDate = new Date(date);
      const normalizedDate = new Date(
        inputDate.getFullYear(),
        inputDate.getMonth(),
        inputDate.getDate()
      );

      console.log('Querying with normalized date:', normalizedDate.toISOString());

      const stepCount = await StepCount.findOne({
        userId,
        date: normalizedDate
      });

      console.log('Found step count:', stepCount);

      // If no step count found, return default object
      const result = stepCount || { count: 0, date: normalizedDate };
      logResponse('verifyStepCount', result);
      return result;
    } catch (error) {
      console.error('Error verifying step count:', error);
      logError('verifyStepCount', error);
      throw error;
    }
  },

  // Get step count for a specific date
  async getStepCount(userId, date) {
    try {
      console.log('Getting step count:', { userId, date });

      // Normalize date to start of day in local timezone
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);

      console.log('Querying with normalized date:', normalizedDate.toISOString());

      const stepCount = await StepCount.findOne({
        userId,
        date: normalizedDate
      });

      console.log('Found step count:', stepCount);

      // Return step count or default object
      return stepCount || {
        count: 0,
        date: normalizedDate,
        source: 'healthkit'
      };
    } catch (error) {
      console.error('Error getting step count:', error);
      throw error;
    }
  },

  // Get step count trend
  async getStepCountTrend(userId) {
    try {
      console.log('Getting step count trend for user:', userId);

      // Get date range for last 7 days
      const now = new Date();
      const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);

      console.log('Querying trend for date range:', {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      });

      // Get step counts for date range
      const stepCounts = await StepCount.find({
        userId,
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ date: 1 });

      console.log('Found step counts:', stepCounts);

      // Fill in missing days with zero counts
      const filledStepCounts = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const existingRecord = stepCounts.find(
          record => record.date.toISOString().split('T')[0] === dateStr
        );

        filledStepCounts.push({
          date: new Date(currentDate),
          count: existingRecord ? existingRecord.count : 0,
          source: 'healthkit'
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log('Filled step counts:', filledStepCounts);
      return filledStepCounts;
    } catch (error) {
      console.error('Error getting step count trend:', error);
      throw error;
    }
  },

  // Get average step count for a date range
  getAverageStepCount: async (userId, startDate, endDate) => {
    try {
      console.log('Getting average step count:', { userId, startDate, endDate });
      logRequest('getAverageStepCount', { userId, startDate, endDate });
      
      // Normalize dates to local timezone
      const inputStartDate = new Date(startDate);
      const normalizedStartDate = new Date(
        inputStartDate.getFullYear(),
        inputStartDate.getMonth(),
        inputStartDate.getDate()
      );
      
      const inputEndDate = new Date(endDate);
      const normalizedEndDate = new Date(
        inputEndDate.getFullYear(),
        inputEndDate.getMonth(),
        inputEndDate.getDate(),
        23, 59, 59, 999
      );

      console.log('Querying average for date range:', {
        startDate: normalizedStartDate.toISOString(),
        endDate: normalizedEndDate.toISOString()
      });

      const stepCounts = await StepCount.find({
        userId,
        date: {
          $gte: normalizedStartDate,
          $lte: normalizedEndDate
        }
      });

      console.log('Found step counts for average:', stepCounts);

      if (stepCounts.length === 0) {
        console.log('No step counts found, returning 0');
        logResponse('getAverageStepCount', 0);
        return 0;
      }

      const totalSteps = stepCounts.reduce((sum, record) => sum + (record.count || 0), 0);
      const average = Math.round(totalSteps / stepCounts.length);
      
      console.log('Calculated average:', { totalSteps, count: stepCounts.length, average });
      logResponse('getAverageStepCount', average);
      return average;
    } catch (error) {
      console.error('Error getting average step count:', error);
      logError('getAverageStepCount', error);
      throw error;
    }
  },

  // Get latest step count
  async getLatestStepCount(userId) {
    try {
      console.log('Getting latest step count for user:', userId);

      const stepCount = await StepCount.findOne({ userId })
        .sort({ date: -1 })
        .limit(1);

      console.log('Found latest step count:', stepCount);

      return stepCount || {
        count: 0,
        date: new Date(),
        source: 'healthkit'
      };
    } catch (error) {
      console.error('Error getting latest step count:', error);
      throw error;
    }
  }
};

module.exports = stepCountService; 