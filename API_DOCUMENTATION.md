# AI Nutrition API Documentation

## Food Analysis and Tracking Endpoints

### 1. Analyze Food Image

Analyzes a food image and returns nutritional information.

**Endpoint:** `POST /api/food/analyze`

**Authentication:** Not required

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `image`: Food image file (JPEG, PNG)

**Response:**
```json
{
  "success": true,
  "data": {
    "foodItems": [
      {
        "name": "apple",
        "calories": 52,
        "servingSize": "100g",
        "mealType": "snack",
        "isHealthy": true,
        "protein": 0.3,
        "carbs": 14,
        "fat": 0.2,
        "fiber": 2.4
      }
    ],
    "totalCalories": 52,
    "timestamp": "2023-06-15T14:30:45.123Z"
  }
}
```

### 2. Add Analyzed Food

Adds analyzed food to the user's daily calories and recent meals.

**Note:** The `mealType` must be one of: "breakfast", "lunch", "dinner", or "snack". If an invalid meal type is provided, it will default to "snack".

**Endpoint:** `POST /api/food/add-analyzed`

**Authentication:** Required (Bearer Token)

**Request:**
- Content-Type: `application/json`
- Body:
```json
{
  "foodItems": [
    {
      "name": "apple",
      "calories": 52,
      "servingSize": "100g",
      "mealType": "snack",
      "isHealthy": true,
      "protein": 0.3,
      "carbs": 14,
      "fat": 0.2,
      "fiber": 2.4
    }
  ],
  "totalCalories": 52,
  "mealType": "snack" // Valid values: "breakfast", "lunch", "dinner", "snack"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meal": {
      "id": "60d21b4667d0d8992e610c85",
      "foodItems": [
        {
          "name": "apple",
          "calories": 52,
          "servingSize": "100g",
          "mealType": "snack",
          "isHealthy": true
        }
      ],
      "totalCalories": 52,
      "mealType": "snack",
      "date": "2023-06-15T14:32:10.123Z"
    },
    "dailyCalories": 1250
  }
}
```

### 3. Get Daily Calorie Count

Retrieves the user's daily calorie count for a specific date.

**Endpoint:** `GET /api/food/daily-calories`

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `date`: Optional. Date in YYYY-MM-DD format. Defaults to today.

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2023-06-15",
    "totalCalories": 1250,
    "lastUpdated": "2023-06-15T14:32:10.123Z"
  }
}
```

### 4. Get Recent Meals

Retrieves the user's recent meals (last 7 days).

**Endpoint:** `GET /api/meals/recent`

**Authentication:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "60d21b4667d0d8992e610c85",
      "username": "johndoe",
      "email": "john@example.com"
    },
    "totalRecentCalories": 8750,
    "count": 15,
    "meals": [
      {
        "id": "60d21b4667d0d8992e610c85",
        "foodItems": [
          {
            "name": "apple",
            "calories": 52,
            "servingSize": "100g",
            "mealType": "snack",
            "isHealthy": true
          }
        ],
        "totalCalories": 52,
        "mealType": "snack",
        "date": "2023-06-15T14:32:10.123Z"
      },
      {
        "id": "60d21b4667d0d8992e610c86",
        "foodItems": [
          {
            "name": "chicken sandwich",
            "calories": 350,
            "servingSize": "100g",
            "mealType": "lunch",
            "isHealthy": true
          }
        ],
        "totalCalories": 350,
        "mealType": "lunch",
        "date": "2023-06-15T12:15:22.456Z"
      }
    ]
  }
}
```

### 5. Get Daily Calories

Retrieves detailed calorie information for a specific date, including breakdown by meal type.

**Endpoint:** `GET /api/meals/daily`

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `date`: Optional. Date in YYYY-MM-DD format. Defaults to today.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "60d21b4667d0d8992e610c85",
      "username": "johndoe",
      "email": "john@example.com",
      "dailyStepGoal": 10000
    },
    "date": "2023-06-15",
    "totalCalories": 1250,
    "caloriesByType": {
      "breakfast": 300,
      "lunch": 450,
      "dinner": 400,
      "snack": 100
    },
    "mealCount": 4,
    "breakdown": [
      {
        "id": "60d21b4667d0d8992e610c85",
        "mealType": "breakfast",
        "calories": 300,
        "time": "2023-06-15T08:00:00.000Z",
        "foodItems": [
          {
            "name": "oatmeal",
            "calories": 150,
            "isHealthy": true
          },
          {
            "name": "banana",
            "calories": 105,
            "isHealthy": true
          },
          {
            "name": "coffee",
            "calories": 45,
            "isHealthy": true
          }
        ]
      },
      {
        "id": "60d21b4667d0d8992e610c86",
        "mealType": "lunch",
        "calories": 450,
        "time": "2023-06-15T12:30:00.000Z",
        "foodItems": [
          {
            "name": "chicken sandwich",
            "calories": 350,
            "isHealthy": true
          },
          {
            "name": "apple",
            "calories": 100,
            "isHealthy": true
          }
        ]
      }
    ]
  }
}
```

## Implementation Details

### Flow for Food Analysis and Tracking

1. **Scan Food Image**
   - Call `POST /api/food/analyze` with the food image
   - Receive analysis with food items and calorie information

2. **Add to Daily Calories and Recent Meals**
   - Call `POST /api/food/add-analyzed` with the analysis result
   - The food is added to the user's daily calories and recent meals

3. **View Daily Calorie Count**
   - Call `GET /api/food/daily-calories` to get the daily calorie count
   - Optionally specify a date to get calories for a different day

4. **View Recent Meals**
   - Call `GET /api/meals/recent` to get the user's recent meals
   - This includes all meals from the last 7 days

### Data Models

1. **DailyCalorie**
   - Tracks total calories consumed per day
   - Indexed by userId and date for efficient querying

2. **Meal**
   - Stores individual meals with food items
   - Includes meal type, calories, and timestamp

### Authentication

All endpoints except `POST /api/food/analyze` require authentication using a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

The token is obtained by logging in with the user's credentials.

## User Profile Endpoints

### 1. Check if Profile Exists

Checks if a user profile has been created.

**Endpoint:** `GET /api/profile/exists`

**Authentication:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "data": {
    "profileExists": true,
    "userId": "60d21b4667d0d8992e610c85"
  }
}
```

### 2. Create Profile

Creates a new user profile with health and fitness information.

**Endpoint:** `POST /api/profile`

**Authentication:** Required (Bearer Token)

**Request:**
- Content-Type: `application/json`
- Body:
```json
{
  "height": 175,
  "weight": 70,
  "fitness_goal": "lose_weight",
  "activity_level": "moderate",
  "age": 30,
  "gender": "male",
  "dietary_restrictions": ["vegetarian", "no_dairy"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "60d21b4667d0d8992e610c85",
    "username": "johndoe",
    "email": "john@example.com",
    "name": "John Doe",
    "height": 175,
    "weight": 70,
    "fitness_goal": "lose_weight",
    "activity_level": "moderate",
    "age": 30,
    "gender": "male",
    "dietary_restrictions": ["vegetarian", "no_dairy"],
    "profile_picture": null,
    "created_at": "2023-06-15T14:32:10.123Z",
    "updated_at": "2023-06-15T14:32:10.123Z"
  }
}
```

### 3. Get Profile

Retrieves the user's profile information.

**Endpoint:** `GET /api/profile`

**Authentication:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "60d21b4667d0d8992e610c85",
    "username": "johndoe",
    "email": "john@example.com",
    "name": "John Doe",
    "height": 175,
    "weight": 70,
    "fitness_goal": "lose_weight",
    "activity_level": "moderate",
    "age": 30,
    "gender": "male",
    "dietary_restrictions": ["vegetarian", "no_dairy"],
    "profile_picture": "uploads/profiles/profilePicture-1623766330123-123456789.jpg",
    "created_at": "2023-06-15T14:32:10.123Z",
    "updated_at": "2023-06-15T14:32:10.123Z"
  }
}
```

### 4. Update Profile

Updates the user's profile information.

**Endpoint:** `PUT /api/profile`

**Authentication:** Required (Bearer Token)

**Request:**
- Content-Type: `application/json`
- Body:
```json
{
  "height": 175,
  "weight": 68,
  "fitness_goal": "maintain",
  "activity_level": "active"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "60d21b4667d0d8992e610c85",
    "username": "johndoe",
    "email": "john@example.com",
    "name": "John Doe",
    "height": 175,
    "weight": 68,
    "fitness_goal": "maintain",
    "activity_level": "active",
    "age": 30,
    "gender": "male",
    "dietary_restrictions": ["vegetarian", "no_dairy"],
    "profile_picture": "uploads/profiles/profilePicture-1623766330123-123456789.jpg",
    "updated_at": "2023-06-16T10:15:30.456Z"
  }
}
```

### 5. Upload Profile Picture

Uploads a profile picture for the user.

**Endpoint:** `POST /api/profile/picture`

**Authentication:** Required (Bearer Token)

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `profilePicture`: Image file (JPEG, PNG)

**Response:**
```json
{
  "success": true,
  "data": {
    "profilePicture": "uploads/profiles/profilePicture-1623766330123-123456789.jpg"
  }
}
```

## AI Chat Endpoints

The application provides a single, unified AI chat system similar to ChatGPT. This system supports:
- Text-based conversations
- Image analysis (upload food images for nutritional analysis)
- Persistent conversation history
- Contextual responses based on previous messages
- Conversation management (view and delete conversations)

### 1. Send Message

Send a message to the AI assistant and receive a response. Supports both text and image inputs.

**Endpoint:** `POST /api/chat/message`

**Authentication:** Required (Bearer Token)

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `message` (required): The user's message text
  - `conversationId` (optional): ID of an existing conversation to continue
  - `parentMessageId` (optional): ID of the message being replied to
  - `image` (optional): An image file to analyze (JPEG, PNG, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "messages": [
      {
        "id": "5f9d88b9e6b5f32a3c7b3e2a",
        "message": "What does this meal contain?",
        "imageUrl": "/uploads/chat-images/1623766330123-meal.jpg",
        "isAI": false,
        "timestamp": "2023-06-15T14:32:10.123Z"
      },
      {
        "id": "5f9d88c0e6b5f32a3c7b3e2b",
        "message": "This meal appears to be a balanced plate with grilled chicken breast, steamed broccoli, and brown rice. The chicken provides lean protein, the broccoli offers fiber, vitamins C and K, and the brown rice contributes complex carbohydrates and additional fiber. This is a nutritionally balanced meal with approximately 400-450 calories, 30g protein, 45g carbs, and 10g fat. It's an excellent choice for muscle recovery and overall health.",
        "isAI": true,
        "timestamp": "2023-06-15T14:32:12.456Z"
      }
    ]
  }
}
```

### 2. Get Chat History

Retrieve conversation history for the authenticated user.

**Endpoint:** `GET /api/chat/history`

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `conversationId` (optional): Filter by specific conversation
- `limit` (optional): Maximum number of messages to return (default: 50)
- `before` (optional): ISO timestamp to get messages before a certain time

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "messages": [
          {
            "id": "5f9d88b9e6b5f32a3c7b3e2a",
            "message": "What does this meal contain?",
            "imageUrl": "/uploads/chat-images/1623766330123-meal.jpg",
            "isAI": false,
            "parentMessageId": null,
            "timestamp": "2023-06-15T14:32:10.123Z"
          },
          {
            "id": "5f9d88c0e6b5f32a3c7b3e2b",
            "message": "This meal appears to be a balanced plate with grilled chicken breast, steamed broccoli, and brown rice. The chicken provides lean protein, the broccoli offers fiber, vitamins C and K, and the brown rice contributes complex carbohydrates and additional fiber. This is a nutritionally balanced meal with approximately 400-450 calories, 30g protein, 45g carbs, and 10g fat. It's an excellent choice for muscle recovery and overall health.",
            "isAI": true,
            "parentMessageId": "5f9d88b9e6b5f32a3c7b3e2a",
            "timestamp": "2023-06-15T14:32:12.456Z"
          }
        ]
      },
      {
        "id": "661f9511-f3ac-52e5-b827-557766551111",
        "messages": [
          {
            "id": "6e0e99caf7c6g43b4d8c4f3b",
            "message": "How many calories should I eat daily?",
            "isAI": false,
            "parentMessageId": null,
            "timestamp": "2023-06-14T10:15:22.789Z"
          },
          {
            "id": "6e0e99d1f7c6g43b4d8c4f3c",
            "message": "Daily calorie needs vary based on factors like age, gender, weight, height, and activity level. For an average adult, the range is typically 1,600-2,400 calories for women and 2,000-3,000 for men. Active individuals need more calories than sedentary ones. For weight loss, a moderate deficit of 500 calories below maintenance is often recommended. For weight gain, a surplus of 300-500 calories is typical. Consider consulting a nutritionist for personalized guidance based on your specific goals and health status.",
            "isAI": true,
            "parentMessageId": "6e0e99caf7c6g43b4d8c4f3b",
            "timestamp": "2023-06-14T10:15:25.123Z"
          }
        ]
      }
    ]
  }
}
```

### 3. Delete Conversation

Delete an entire conversation history.

**Endpoint:** `DELETE /api/chat/conversation/:conversationId`

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `conversationId` (required): ID of the conversation to delete

**Response:**
```json
{
  "success": true,
  "message": "Conversation deleted successfully",
  "data": {
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "deletedCount": 8
  }
}
```

## Implementation Details for AI Chat

### Simple AI Chat

The simple AI chat endpoint (`/api/ai/chat`) uses OpenAI's text-davinci-003 model to generate responses to user queries about nutrition and fitness. It:

- Accepts a user message and optional context
- Formats a prompt for the AI model with specific instructions
- Returns a concise, formatted response from the AI

This endpoint is ideal for simple Q&A interactions where persistent conversation history isn't needed.

### Advanced Chat System

The advanced chat system (`/api/chat/*` endpoints) provides a full-featured chat experience:

1. **Persistent Conversations**
   - Conversations are stored in MongoDB with the Chat model
   - Each conversation has a unique ID and contains multiple messages
   - Messages are linked with parent-child relationships

2. **Image Analysis**
   - Users can upload food images with their messages
   - Images are analyzed using OpenAI's GPT-4 Vision model
   - The AI provides nutritional insights based on the image content

3. **Conversation Management**
   - Users can retrieve their conversation history
   - Conversations can be filtered by ID or time
   - Users can delete entire conversations

4. **Advanced AI Processing**
   - Uses GPT-4 Turbo for high-quality responses
   - Incorporates conversation context for more relevant replies
   - Handles both text and image inputs in a single request

### Usage Recommendations

- **Simple AI Chat**: Use for quick, one-off questions about nutrition and fitness
- **Advanced Chat System**: Use for ongoing conversations, food image analysis, and when you need to reference previous messages
```