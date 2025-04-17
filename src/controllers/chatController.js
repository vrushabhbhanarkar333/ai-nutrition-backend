const chatService = require('../services/chatService');

const chatController = {
  sendMessage: async (req, res) => {
    try {
      const { message } = req.body;
      const userId = req.user.id;
      const response = await chatService.processMessage(userId, message);
      res.json(response);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getChatHistory: async (req, res) => {
    try {
      const userId = req.user.id;
      const history = await chatService.getChatHistory(userId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = chatController; 