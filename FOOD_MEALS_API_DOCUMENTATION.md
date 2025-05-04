# Food and Meals API Documentation

This document provides detailed information about the Food and Meals related API endpoints in the AI Nutrition application.

## Table of Contents

1. [Food Analysis API](#food-analysis-api)
   - [Analyze Food Image](#analyze-food-image)
   - [Add Analyzed Food](#add-analyzed-food)
   - [Get Daily Calories](#get-daily-calories-food-controller)

2. [Meals API](#meals-api)
   - [Get Recent Meals](#get-recent-meals)
   - [Get Daily Calories](#get-daily-calories-meal-controller)
   - [Get Meal History](#get-meal-history)
   - [Get Calories by Date Range](#get-calories-by-date-range)
   - [Get Meal by ID](#get-meal-by-id)

---

## Food Analysis API

### Analyze Food Image

Analyzes a food image and returns nutritional information.

- **URL**: `/api/food/analyze`
- **Method**: `POST`
- **Authentication**: Not required
- **Content-Type**: `multipart/form-data`

**Request Parameters**:

| Parameter | Type   | Required | Description                                |
|-----------|--------|----------|--------------------------------------------|
| image     | File   | Yes      | Image file of food to analyze (max 5MB)    |

**Response**:

```json
{
  "success": true,
  "data": {
    "foodItems": [
      {
        "name": "Apple",
        "calories": 52,
        "servingSize": "100g",
        "isHealthy": true,
        "protein": 0.3,
        "carbs": 14,
        "fat": 0.2,
        "fiber": 2.4
      }
    ],
    "totalCalories": 52,
    "imageUrl": "https://res.cloudinary.com/example/image.jpg",
    "imagePublicId": "food-analysis/image123",
    "timestamp": "2023-04-20T12:34:56.789Z"
  }
}
```

**Error Response**:

```json
{
  "success": false,
  "error": "No image file provided"
}
```

```json
{
  "success": false,
  "error": "File must be an image"
}
```

```json
{
  "success": false,
  "message": "Error analyzing food image",
  "error": "Error message details"
}
```

### Add Analyzed Food

Adds analyzed food to the user's daily calories and recent meals.

- **URL**: `/api/food/add-analyzed`
- **Method**: `POST`
- **Authentication**: Required
- **Content-Type**: `application/json`

**Request Body**:

```json
{
  "foodItems": [
    {
      "name": "Apple",
      "calories": 52,
      "servingSize": "100g",
      "isHealthy": true,
      "protein": 0.3,
      "carbs": 14,
      "fat": 0.2,
      "fiber": 2.4
    }
  ],
  "totalCalories": 52,
  "mealType": "snack"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "meal": {
      "id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "foodItems": [
        {
          "name": "Apple",
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
      "totalNutrition": {
        "protein": 0.3,
        "carbs": 14,
        "fat": 0.2,
        "fiber": 2.4
      },
      "mealType": "snack",
      "date": "2023-04-20T12:34:56.789Z"
    },
    "dailyCalories": 1200
  }
}
```

**Error Response**:

```json
{
  "success": false,
  "error": "Food items are required and must be an array"
}
```

```json
{
  "success": false,
  "error": "Meal type is required"
}
```

### Get Daily Calories (Food Controller)

Gets the daily calorie count for a user.

- **URL**: `/api/food/daily-calories`
- **Method**: `GET`
- **Authentication**: Required

**Query Parameters**:

| Parameter | Type   | Required | Description                                |
|-----------|--------|----------|--------------------------------------------|
| date      | String | No       | Date in YYYY-MM-DD format (defaults to today) |

**Response**:

```json
{
  "success": true,
  "data": {
    "date": "2023-04-20",
    "totalCalories": 1200,
    "lastUpdated": "2023-04-20T12:34:56.789Z"
  }
}
```

**Error Response**:

```json
{
  "success": false,
  "error": "Error message details"
}
```

---

## Meals API

### Get Recent Meals

Gets the user's meals from the last 7 days.

- **URL**: `/api/meals/recent`
- **Method**: `GET`
- **Authentication**: Required

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "username": "johndoe",
      "email": "john@example.com"
    },
    "totalRecentCalories": 8500,
    "count": 15,
    "meals": [
      {
        "id": "60a1b2c3d4e5f6g7h8i9j0k1",
        "foodItems": [
          {
            "name": "Apple",
            "calories": 52,
            "servingSize": "100g",
            "mealType": "snack",
            "isHealthy": true
          }
        ],
        "totalCalories": 52,
        "mealType": "snack",
        "date": "2023-04-20T12:34:56.789Z"
      }
    ]
  }
}
```

### Get Daily Calories (Meal Controller)

Gets the daily calorie count and meal breakdown for a specific date.

- **URL**: `/api/meals/daily`
- **Method**: `GET`
- **Authentication**: Required

**Query Parameters**:

| Parameter | Type   | Required | Description                                |
|-----------|--------|----------|--------------------------------------------|
| date      | String | No       | Date in YYYY-MM-DD format (defaults to today) |

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "username": "johndoe",
      "email": "john@example.com",
      "dailyStepGoal": 10000
    },
    "date": "2023-04-20",
    "totalCalories": 1200,
    "caloriesByType": {
      "breakfast": 300,
      "lunch": 450,
      "dinner": 400,
      "snack": 50
    },
    "mealCount": 4,
    "breakdown": [
      {
        "id": "60a1b2c3d4e5f6g7h8i9j0k1",
        "mealType": "breakfast",
        "calories": 300,
        "time": "2023-04-20T08:00:00.000Z",
        "foodItems": [
          {
            "name": "Oatmeal",
            "calories": 150,
            "isHealthy": true
          },
          {
            "name": "Banana",
            "calories": 150,
            "isHealthy": true
          }
        ]
      }
    ]
  }
}
```

### Get Meal History

Gets the meal history for a specific date.

- **URL**: `/api/meals/history`
- **Method**: `GET`
- **Authentication**: Required

**Query Parameters**:

| Parameter | Type   | Required | Description                                |
|-----------|--------|----------|--------------------------------------------|
| date      | String | Yes      | Date in YYYY-MM-DD format                  |

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "username": "johndoe",
      "email": "john@example.com"
    },
    "date": "2023-04-20",
    "totalCalories": 1200,
    "mealCount": 4,
    "meals": [
      {
        "id": "60a1b2c3d4e5f6g7h8i9j0k1",
        "mealType": "breakfast",
        "totalCalories": 300,
        "time": "2023-04-20T08:00:00.000Z",
        "foodItems": [
          {
            "name": "Oatmeal",
            "calories": 150,
            "servingSize": "100g",
            "mealType": "breakfast",
            "isHealthy": true
          },
          {
            "name": "Banana",
            "calories": 150,
            "servingSize": "100g",
            "mealType": "breakfast",
            "isHealthy": true
          }
        ]
      }
    ]
  }
}
```

**Error Response**:

```json
{
  "success": false,
  "error": "Date parameter is required (format: YYYY-MM-DD)"
}
```

### Get Calories by Date Range

Gets the calorie summary for a date range (e.g., weekly overview).

- **URL**: `/api/meals/range`
- **Method**: `GET`
- **Authentication**: Required

**Query Parameters**:

| Parameter | Type   | Required | Description                                |
|-----------|--------|----------|--------------------------------------------|
| startDate | String | Yes      | Start date in YYYY-MM-DD format            |
| endDate   | String | Yes      | End date in YYYY-MM-DD format              |

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "username": "johndoe",
      "email": "john@example.com"
    },
    "startDate": "2023-04-14",
    "endDate": "2023-04-20",
    "totalCalories": 8500,
    "dailySummary": [
      {
        "date": "2023-04-14",
        "totalCalories": 1200,
        "mealCount": 4
      },
      {
        "date": "2023-04-15",
        "totalCalories": 1300,
        "mealCount": 3
      }
    ]
  }
}
```

**Error Response**:

```json
{
  "success": false,
  "error": "Both startDate and endDate parameters are required (format: YYYY-MM-DD)"
}
```

### Get Meal by ID

Gets a specific meal by its ID.

- **URL**: `/api/meals/:id`
- **Method**: `GET`
- **Authentication**: Required

**URL Parameters**:

| Parameter | Type   | Required | Description                                |
|-----------|--------|----------|--------------------------------------------|
| id        | String | Yes      | Meal ID                                    |

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "username": "johndoe",
      "email": "john@example.com"
    },
    "meal": {
      "id": "60a1b2c3d4e5f6g7h8i9j0k1",
      "foodItems": [
        {
          "name": "Oatmeal",
          "calories": 150,
          "servingSize": "100g",
          "mealType": "breakfast",
          "isHealthy": true,
          "protein": 5,
          "carbs": 27,
          "fat": 3,
          "fiber": 4
        }
      ],
      "totalCalories": 150,
      "totalNutrition": {
        "protein": 5,
        "carbs": 27,
        "fat": 3,
        "fiber": 4
      },
      "mealType": "breakfast",
      "date": "2023-04-20T08:00:00.000Z"
    }
  }
}
```

**Error Response**:

```json
{
  "success": false,
  "error": "Meal ID is required"
}
```

```json
{
  "success": false,
  "error": "Meal not found"
}
```

## Data Models

### Meal Model

```javascript
{
  userId: ObjectId,  // Reference to User model
  foodItems: [
    {
      name: String,
      calories: Number,
      servingSize: String,
      mealType: String,  // 'breakfast', 'lunch', 'dinner', 'snack'
      isHealthy: Boolean,
      protein: Number,   // in grams
      carbs: Number,     // in grams
      fat: Number,       // in grams
      fiber: Number      // in grams
    }
  ],
  totalCalories: Number,
  date: Date,
  mealType: String  // 'breakfast', 'lunch', 'dinner', 'snack'
}
```

### DailyCalorie Model

```javascript
{
  userId: ObjectId,  // Reference to User model
  date: Date,
  totalCalories: Number,
  lastUpdated: Date
}
```