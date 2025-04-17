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
    type: Number,
    required: true
  },
  profilePicture: {
    type: String,
    default: null
  },
  fitnessGoals: {
    type: String,
    enum: ['weight_loss', 'muscle_gain', 'maintenance', 'endurance'],
    default: 'maintenance'
  },
  activityLevel: {
    type: String,
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    default: 'moderate'
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
    // BMI = weight(kg) / (height(m))^2
    const heightInMeters = this.height / 100;
    this.bmi = (this.weight / (heightInMeters * heightInMeters)).toFixed(2);
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Profile', profileSchema); 