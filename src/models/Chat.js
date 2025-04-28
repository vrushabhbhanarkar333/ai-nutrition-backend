const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversationId: {
    type: String,
    required: true
  },
  parentMessageId: {
    type: String,
    default: null
  },
  message: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: null
  },
  isAI: {
    type: Boolean,
    required: true
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Chat', chatSchema);