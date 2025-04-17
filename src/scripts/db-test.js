// This script tests the database connection and operations
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Meal = require('../models/Meal');

// Connect to MongoDB
async function testDB() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
    
    // Print collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:', collections.map(c => c.name));

    // Test user operations
    console.log('\n--- Testing User operations ---');
    const testUser = new User({
      username: `test_user_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'testpassword123'
    });
    
    await testUser.save();
    console.log('Test user created:', testUser._id);
    
    const retrievedUser = await User.findById(testUser._id);
    console.log('Retrieved user:', retrievedUser._id);
    
    // Remove test user
    await User.findByIdAndDelete(testUser._id);
    console.log('Test user deleted');
    
    // Count documents in collections
    const userCount = await User.countDocuments();
    const profileCount = await Profile.countDocuments();
    const mealCount = await Meal.countDocuments();
    
    console.log('\n--- Database Statistics ---');
    console.log(`Users: ${userCount}`);
    console.log(`Profiles: ${profileCount}`);
    console.log(`Meals: ${mealCount}`);
    
    // Print 3 users as sample
    if (userCount > 0) {
      console.log('\n--- Sample Users ---');
      const users = await User.find().limit(3);
      users.forEach((user, idx) => {
        console.log(`User ${idx + 1}:`, {
          id: user._id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt
        });
      });
    }

    console.log('\nDatabase operations test completed successfully');
  } catch (error) {
    console.error('Error during database test:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run test
testDB(); 