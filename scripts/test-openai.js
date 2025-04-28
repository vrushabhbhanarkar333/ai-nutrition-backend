const OpenAI = require('openai');

try {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('OpenAI API initialized successfully:', openai);
} catch (error) {
  console.error('Error initializing OpenAI API:', error);
}