const mongoose = require('mongoose');

const dailyCalorieSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  totalCalories: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Create index for efficient querying
dailyCalorieSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyCalorie', dailyCalorieSchema);