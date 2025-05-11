const mongoose = require('mongoose');

const dietaryPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dietType: {
    type: String,
    enum: ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'other'],
    default: 'omnivore'
  },
  allergies: [{
    type: String
  }],
  intolerances: [{
    type: String
  }],
  dislikedFoods: [{
    type: String
  }],
  preferredFoods: [{
    type: String
  }],
  mealPreferences: {
    breakfast: {
      type: Boolean,
      default: true
    },
    lunch: {
      type: Boolean,
      default: true
    },
    dinner: {
      type: Boolean,
      default: true
    },
    snacks: {
      type: Number,
      default: 2
    }
  },
  calorieGoal: {
    type: Number,
    default: 2000
  },
  macroGoals: {
    protein: {
      type: Number, // percentage
      default: 30
    },
    carbs: {
      type: Number, // percentage
      default: 40
    },
    fat: {
      type: Number, // percentage
      default: 30
    }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('DietaryPreferences', dietaryPreferencesSchema);
