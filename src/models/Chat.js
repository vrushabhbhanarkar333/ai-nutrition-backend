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
  // Vector embedding for semantic search
  embedding: {
    type: [Number],
    default: null,
    index: false // MongoDB is not optimized for vector search, we'll use ClickHouse
  },
  // Flag to track if this message has been embedded
  isEmbedded: {
    type: Boolean,
    default: false
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