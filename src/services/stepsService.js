// Mock steps data storage
const userSteps = new Map();

const stepsService = {
  getUserSteps: async (userId) => {
    // Get user's steps data
    const stepsData = userSteps.get(userId) || {
      steps: 0,
      goal: 10000,
      lastUpdated: new Date()
    };

    return {
      userId,
      steps: stepsData.steps,
      goal: stepsData.goal,
      lastUpdated: stepsData.lastUpdated
    };
  },

  updateUserSteps: async (userId, steps) => {
    // Update user's steps data
    const currentData = userSteps.get(userId) || {
      steps: 0,
      goal: 10000,
      lastUpdated: new Date()
    };

    const updatedData = {
      steps: parseInt(steps),
      goal: currentData.goal,
      lastUpdated: new Date()
    };

    userSteps.set(userId, updatedData);

    return {
      userId,
      steps: updatedData.steps,
      goal: updatedData.goal,
      lastUpdated: updatedData.lastUpdated
    };
  }
};

module.exports = stepsService; 