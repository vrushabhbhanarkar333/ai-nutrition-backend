const mongoose = require('mongoose');

const stepsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  steps: {
    type: Number,
    required: true,
    default: 0
  },
  goal: {
    type: Number,
    required: true,
    default: 10000
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Steps', stepsSchema); 