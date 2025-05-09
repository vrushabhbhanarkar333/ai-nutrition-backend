const mongoose = require('mongoose');

const dietaryPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dietType: {
    type: String,
    enum: ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'mediterranean', 'other'],
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
  calorieGoal: {
    type: Number,
    default: 2000
  },
  proteinGoal: {
    type: Number,
    default: 50 // in grams
  },
  carbGoal: {
    type: Number,
    default: 250 // in grams
  },
  fatGoal: {
    type: Number,
    default: 70 // in grams
  },
  mealFrequency: {
    type: Number,
    default: 3
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('DietaryPreferences', dietaryPreferencesSchema);