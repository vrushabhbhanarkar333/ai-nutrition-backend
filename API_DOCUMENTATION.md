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