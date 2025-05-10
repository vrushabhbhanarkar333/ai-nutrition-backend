const mongoose = require('mongoose');

const healthKitDataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  steps: {
    count: {
      type: Number,
      required: true,
      default: 0
    },
    goal: {
      type: Number,
      default: 10000
    },
    progress: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    source: {
      type: String,
      default: 'Apple HealthKit'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'failed'],
      default: 'synced'
    }
  }
}, {
  timestamps: true
});

// Create compound index for efficient querying
healthKitDataSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('HealthKitData', healthKitDataSchema); 