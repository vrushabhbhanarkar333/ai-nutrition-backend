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
  // Add dateString field for timezone-independent date filtering
  dateString: {
    type: String,
    // Format: YYYY-MM-DD
    default: function() {
      return new Date().toISOString().split('T')[0];
    }
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
// Add index for dateString for faster lookups
dailyCalorieSchema.index({ userId: 1, dateString: 1 });

module.exports = mongoose.model('DailyCalorie', dailyCalorieSchema);