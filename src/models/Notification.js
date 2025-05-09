const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['reminder', 'alert', 'tip', 'achievement', 'question', 'other'],
    required: true
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
    default: null
  },
  answer: {
    type: String,
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isAnswered: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['nutrition', 'fitness', 'health', 'general', 'system'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  actionRequired: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', notificationSchema);