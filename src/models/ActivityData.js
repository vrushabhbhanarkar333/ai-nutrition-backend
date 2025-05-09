const mongoose = require('mongoose');

const activityDataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  activityType: {
    type: String,
    enum: ['walking', 'running', 'cycling', 'swimming', 'weightlifting', 'yoga', 'other'],
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  caloriesBurned: {
    type: Number,
    default: 0
  },
  distance: {
    type: Number, // in kilometers
    default: null
  },
  steps: {
    type: Number,
    default: null
  },
  heartRate: {
    average: {
      type: Number,
      default: null
    },
    max: {
      type: Number,
      default: null
    }
  },
  notes: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('ActivityData', activityDataSchema);