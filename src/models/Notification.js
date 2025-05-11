const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['reminder', 'alert', 'achievement', 'tip', 'question', 'other'],
    default: 'other'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  question: {
    type: String,
    default: ''
  },
  answer: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isAnswered: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Default expiration is 7 days from creation
      const date = new Date();
      date.setDate(date.getDate() + 7);
      return date;
    }
  },
  metadata: {
    type: Map,
    of: String,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
