const foodService = require('../services/foodService');

const foodController = {
  analyzeFood: async (req, res) => {
    try {
      console.log('Received file:', req.file);
      
      if (!req.file) {
        console.log('No file provided in request');
        return res.status(400).json({ 
          success: false,
          error: 'No image file provided' 
        });
      }

      // Check if the file is an image
      if (!req.file.mimetype.startsWith('image/')) {
        console.log('Invalid file type:', req.file.mimetype);
        return res.status(400).json({ 
          success: false,
          error: 'File must be an image' 
        });
      }

      console.log('Processing image:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      // Analyze the food using the service
      const result = await foodService.analyzeFood(req.file.buffer);
      
      console.log('Analysis result:', result);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in foodController:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error analyzing food image',
        error: error.message 
      });
    }
  }
};

module.exports = foodController; 