# AI Chat Implementation Guide

This guide explains how to use the AI chat functionality in the AI Nutrition application.

## Overview

The application provides two different AI chat implementations:

1. **Simple AI Chat** (`/api/ai/chat`) - A lightweight endpoint for quick nutrition and fitness questions
2. **Advanced Chat System** (`/api/chat/*`) - A full-featured chat system with conversation history, image analysis, and more

## Prerequisites

- Valid authentication token (JWT)
- API endpoint URL (default: `http://localhost:3000/api`)

## Simple AI Chat

### Features
- Quick, stateless AI responses to nutrition and fitness questions
- Optional context array for providing conversation history in a single request
- Concise, formatted responses

### Example Usage

```javascript
// Using fetch API
async function askSimpleQuestion() {
  const response = await fetch('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_AUTH_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: "What are good sources of protein for vegetarians?",
      context: [] // Optional previous conversation context
    })
  });
  
  const data = await response.json();
  console.log(data.data.message); // AI response
}
```

## Advanced Chat System

### Features
- Persistent conversation history
- Image analysis for food photos
- Conversation management (retrieve, continue, delete)
- Parent-child message relationships

### Example Usage

#### 1. Send a Text Message

```javascript
// Using fetch API with FormData
async function sendChatMessage() {
  const formData = new FormData();
  formData.append('message', 'How many calories should I eat daily?');
  
  const response = await fetch('http://localhost:3000/api/chat/message', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_AUTH_TOKEN'
    },
    body: formData
  });
  
  const data = await response.json();
  const conversationId = data.data.conversationId;
  console.log(data.data.messages); // Contains both user message and AI response
  
  return conversationId; // Save for continuing the conversation
}
```

#### 2. Continue a Conversation

```javascript
async function continueConversation(conversationId) {
  const formData = new FormData();
  formData.append('message', 'What about exercise?');
  formData.append('conversationId', conversationId);
  
  const response = await fetch('http://localhost:3000/api/chat/message', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_AUTH_TOKEN'
    },
    body: formData
  });
  
  const data = await response.json();
  console.log(data.data.messages);
}
```

#### 3. Send an Image for Analysis

```javascript
async function sendFoodImage(imagePath, conversationId = null) {
  const formData = new FormData();
  formData.append('message', 'What does this meal contain?');
  formData.append('image', /* File object from input or other source */);
  
  if (conversationId) {
    formData.append('conversationId', conversationId);
  }
  
  const response = await fetch('http://localhost:3000/api/chat/message', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_AUTH_TOKEN'
    },
    body: formData
  });
  
  const data = await response.json();
  console.log(data.data.messages);
}
```

#### 4. Get Chat History

```javascript
// Get all conversations
async function getChatHistory() {
  const response = await fetch('http://localhost:3000/api/chat/history', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer YOUR_AUTH_TOKEN'
    }
  });
  
  const data = await response.json();
  console.log(data.data.conversations);
}

// Get specific conversation
async function getConversation(conversationId) {
  const response = await fetch(`http://localhost:3000/api/chat/history?conversationId=${conversationId}`, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer YOUR_AUTH_TOKEN'
    }
  });
  
  const data = await response.json();
  console.log(data.data.conversations[0].messages);
}
```

#### 5. Delete a Conversation

```javascript
async function deleteConversation(conversationId) {
  const response = await fetch(`http://localhost:3000/api/chat/conversation/${conversationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer YOUR_AUTH_TOKEN'
    }
  });
  
  const data = await response.json();
  console.log(data.message); // "Conversation deleted successfully"
}
```

## Testing the API

A test script is included in the repository to demonstrate all the AI chat functionality:

```bash
# Install dependencies if needed
npm install axios form-data

# Run the test script
node test-ai-chat.js
```

Make sure to:
1. Replace `YOUR_AUTH_TOKEN` with a valid authentication token
2. Add a test image named `test-meal.jpg` to the project root if you want to test image analysis

## Implementation Details

### Simple AI Chat
- Uses OpenAI's text-davinci-003 model
- Responses are formatted as concise paragraphs
- No persistent storage of conversations

### Advanced Chat System
- Uses MongoDB to store conversation history
- Uses OpenAI's GPT-4 Turbo for text responses
- Uses OpenAI's GPT-4 Vision for image analysis
- Supports file uploads for food images
- Maintains conversation context for more relevant responses

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "path": "/api/chat/message",
  "timestamp": "2023-06-15T14:32:10.123Z"
}
```

Common error scenarios:
- 400: Missing required fields (message)
- 401: Invalid or missing authentication token
- 413: Image file too large (>5MB)
- 500: Server-side processing errors

## Further Information

For complete API documentation, see the [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) file.