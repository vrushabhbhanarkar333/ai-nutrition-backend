const mongoose = require('mongoose');

const activityDataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['walking', 'running', 'cycling', 'swimming', 'weightlifting', 'yoga', 'other'],
    default: 'other'
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  caloriesBurned: {
    type: Number,
    default: 0
  },
  distance: {
    type: Number, // in kilometers
    default: 0
  },
  steps: {
    type: Number,
    default: 0
  },
  heartRate: {
    average: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: 0
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('ActivityData', activityDataSchema);
