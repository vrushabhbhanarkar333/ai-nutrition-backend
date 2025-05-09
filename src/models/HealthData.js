const mongoose = require('mongoose');

const healthDataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  height: {
    type: Number,
    default: null
  },
  weight: {
    type: Number,
    default: null
  },
  bmi: {
    type: Number,
    default: null
  },
  bloodPressure: {
    systolic: {
      type: Number,
      default: null
    },
    diastolic: {
      type: Number,
      default: null
    }
  },
  heartRate: {
    type: Number,
    default: null
  },
  sleepHours: {
    type: Number,
    default: null
  },
  waterIntake: {
    type: Number,
    default: null
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('HealthData', healthDataSchema);