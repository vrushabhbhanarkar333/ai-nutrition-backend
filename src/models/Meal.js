const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  foodItems: [{
    name: {
      type: String,
      required: true
    },
    calories: {
      type: Number,
      required: true
    },
    servingSize: {
      type: String,
      default: '100g'
    },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: true
    },
    isHealthy: {
      type: Boolean,
      default: false
    },
    // Add nutrition fields
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
  }],
  totalCalories: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    required: true
  },
  totalNutrition: {
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 }
  }  
});

// Create index for efficient querying
mealSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Meal', mealSchema);