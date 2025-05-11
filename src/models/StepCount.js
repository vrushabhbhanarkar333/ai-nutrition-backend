const mongoose = require('mongoose');

const stepCountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  count: {
    type: Number,
    required: true,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for userId and date
stepCountSchema.index({ userId: 1, date: 1 }, { unique: true });

// Add method to get step count for a date range
stepCountSchema.statics.getStepCountForDateRange = async function(userId, startDate, endDate) {
  return this.find({
    userId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: 1 });
};

// Add method to get latest step count
stepCountSchema.statics.getLatestStepCount = async function(userId) {
  return this.findOne({ userId })
    .sort({ date: -1 })
    .limit(1);
};

const StepCount = mongoose.model('StepCount', stepCountSchema);

module.exports = StepCount; 