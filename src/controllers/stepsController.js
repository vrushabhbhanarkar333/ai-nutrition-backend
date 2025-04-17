const stepsService = require('../services/stepsService');

const stepsController = {
  getSteps: async (req, res) => {
    try {
      const userId = req.user.id;
      const steps = await stepsService.getUserSteps(userId);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  updateSteps: async (req, res) => {
    try {
      const userId = req.user.id;
      const { steps } = req.body;
      const updatedSteps = await stepsService.updateUserSteps(userId, steps);
      res.json(updatedSteps);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = stepsController; 