const mongoose = require('mongoose');

const statsDataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dailyCalories: {
    goal: {
      type: Number,
      default: 2000
    },
    consumed: {
      type: Number,
      default: 0
    },
    burned: {
      type: Number,
      default: 0
    }
  },
  macros: {
    protein: {
      type: Number,
      default: 0
    },
    carbs: {
      type: Number,
      default: 0
    },
    fat: {
      type: Number,
      default: 0
    },
    fiber: {
      type: Number,
      default: 0
    }
  },
  steps: {
    goal: {
      type: Number,
      default: 10000
    },
    current: {
      type: Number,
      default: 0
    }
  },
  waterIntake: {
    goal: {
      type: Number,
      default: 8
    },
    current: {
      type: Number,
      default: 0
    }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('StatsData', statsDataSchema);
