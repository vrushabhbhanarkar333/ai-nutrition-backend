const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  height: {
    type: Number,
    required: true,
    min: 100, // in cm
    max: 250
  },
  weight: {
    type: Number,
    required: true,
    min: 20, // in kg
    max: 300
  },
  bmi: {
    type: Number
  },
  age: {
    type: Number,
    min: 13,
    max: 120
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say']
  },
  fitness_goal: {
    type: String,
    enum: ['lose_weight', 'maintain', 'gain_weight', 'build_muscle'],
    required: true
  },
  activity_level: {
    type: String,
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    required: true
  },
  dietary_restrictions: {
    type: [String],
    default: []
  },
  profilePicture: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate BMI before saving
profileSchema.pre('save', function(next) {
  if (this.isModified('height') || this.isModified('weight')) {
    // Only calculate BMI if both height and weight are present
    if (this.height && this.weight) {
      // BMI = weight(kg) / (height(m))^2
      const heightInMeters = this.height / 100;
      this.bmi = parseFloat((this.weight / (heightInMeters * heightInMeters)).toFixed(2));
    }
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Profile', profileSchema); 