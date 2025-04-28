# Debug Mode for AI Chat Endpoints

This document explains how to use the debug mode for AI chat-related endpoints in the application.

## Enabling Debug Mode

Debug mode can be enabled by setting the `DEBUG_MODE` environment variable to `true`. This will activate detailed logging for all AI chat endpoints.

### Using Environment Variable

```bash
# For Linux/Mac
export DEBUG_MODE=true
npm start

# For Windows (Command Prompt)
set DEBUG_MODE=true
npm start

# For Windows (PowerShell)
$env:DEBUG_MODE="true"
npm start
```

### Using .env File

Alternatively, you can add the following line to your `.env` file:

```
DEBUG_MODE=true
```

## Debug Logs

When debug mode is enabled, the application will log detailed information about:

1. Incoming requests
2. Database queries
3. OpenAI API calls
4. Response data
5. Errors

Each log entry includes:
- Timestamp
- Endpoint name
- Log type (REQUEST, RESPONSE, ERROR)
- Detailed data

## AI Chat Endpoints with Debug Logging

The following endpoints have enhanced debug logging:

### 1. POST /api/chat/message

Logs information about:
- User message details
- Image processing (if applicable)
- Conversation context retrieval
- OpenAI API calls
- AI response generation
- Database operations

### 2. GET /api/chat/history

Logs information about:
- Query parameters
- Database queries
- Message grouping by conversation
- Response formatting

### 3. DELETE /api/chat/conversation/:conversationId

Logs information about:
- Conversation ID validation
- Message count before deletion
- Database deletion operation
- Operation result

### 4. POST /api/ai/chat

Logs information about:
- User message and context
- OpenAI API calls
- AI response generation

## Debug Log Format

Debug logs follow this format:

```
[DEBUG][TIMESTAMP][ENDPOINT][TYPE] ==========================================
[DEBUG][TIMESTAMP][ENDPOINT][TYPE] {JSON data}
[DEBUG][TIMESTAMP][ENDPOINT][TYPE] ==========================================
```

## Troubleshooting with Debug Logs

When investigating issues:

1. Enable debug mode
2. Reproduce the issue
3. Check the logs for:
   - Request parameters
   - Error messages
   - API responses
   - Database query results

## Performance Considerations

Debug mode generates significant additional logging and should only be enabled in development or when troubleshooting specific issues. It is not recommended for production use due to:

1. Performance impact
2. Increased log volume
3. Potential exposure of sensitive information in logs

Always disable debug mode in production environments.