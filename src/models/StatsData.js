const mongoose = require('mongoose');

const statsDataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caloriesConsumed: {
    type: Number,
    default: 0
  },
  caloriesBurned: {
    type: Number,
    default: 0
  },
  proteinIntake: {
    type: Number,
    default: 0
  },
  carbIntake: {
    type: Number,
    default: 0
  },
  fatIntake: {
    type: Number,
    default: 0
  },
  stepsCount: {
    type: Number,
    default: 0
  },
  workoutMinutes: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('StatsData', statsDataSchema);