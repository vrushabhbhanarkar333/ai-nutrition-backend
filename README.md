# AI Nutrition Backend

A Node.js backend for an AI-powered nutrition and fitness tracking application.

## Features

- User authentication (register/login)
- Food image analysis for calorie counting
- Step tracking with notifications
- AI chat conversation (text and voice)
- Real-time notifications using Firebase

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- OpenAI API key
- Firebase project setup

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and add your environment variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/ai-nutrition
   JWT_SECRET=your-secret-key-here
   OPENAI_API_KEY=your-openai-api-key-here
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-client-email
   FIREBASE_PRIVATE_KEY=your-private-key
   ```

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register a new user
- POST `/api/auth/login` - Login user

### Food Analysis
- POST `/api/food/analyze` - Analyze food image and return calorie information
- POST `/api/food/add-analyzed` - Add analyzed food to daily calories and recent meals
- GET `/api/food/daily-calories` - Get daily calorie count

### Steps Tracking
- POST `/api/steps/update` - Update user's step count
- PUT `/api/steps/goal` - Update user's step goal
- POST `/api/steps/notification-token` - Save user's notification token

### AI Chat
- POST `/api/chat/text` - Text-based chat with AI
- POST `/api/chat/voice` - Voice-based chat with AI

## Security

- JWT-based authentication
- Password hashing using bcrypt
- Environment variables for sensitive data
- CORS enabled for frontend communication

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 