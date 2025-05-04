const mongoose = require('mongoose');

const engagementMessageSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['meal_reminder', 'fitness', 'progress', 'hydration', 'evening'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EngagementMessage', engagementMessageSchema);