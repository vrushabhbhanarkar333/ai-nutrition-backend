/**
 * Debug logger utility for API endpoints
 * Provides consistent debug logging across the application
 */

const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || false;

/**
 * Log debug information if debug mode is enabled
 * @param {string} endpoint - The API endpoint being called
 * @param {Object} data - Data to log (request, response, etc.)
 * @param {string} type - Type of log (request, response, error)
 */
const debugLog = (endpoint, data, type = 'info') => {
  if (!DEBUG_MODE) return;

  const timestamp = new Date().toISOString();
  const prefix = `[DEBUG][${timestamp}][${endpoint}][${type.toUpperCase()}]`;
  
  console.log(`${prefix} ==========================================`);
  
  if (typeof data === 'object') {
    // Handle circular references in objects
    try {
      console.log(`${prefix} ${JSON.stringify(data, getCircularReplacer(), 2)}`);
    } catch (error) {
      console.log(`${prefix} Object contains circular references or is too complex to stringify`);
      console.log(`${prefix} Object keys:`, Object.keys(data));
    }
  } else {
    console.log(`${prefix} ${data}`);
  }
  
  console.log(`${prefix} ==========================================`);
};

/**
 * Helper function to handle circular references in JSON.stringify
 */
const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    return value;
  };
};

/**
 * Log request information
 * @param {string} endpoint - The API endpoint being called
 * @param {Object} req - Express request object
 */
const logRequest = (endpoint, req) => {
  if (!DEBUG_MODE) return;
  
  const requestData = {
    method: req.method,
    url: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'authorization': req.headers['authorization'] ? 'Bearer [REDACTED]' : undefined
    },
    user: req.user ? { id: req.user._id, username: req.user.username } : undefined
  };
  
  debugLog(endpoint, requestData, 'request');
};

/**
 * Log response information
 * @param {string} endpoint - The API endpoint being called
 * @param {Object} data - Response data
 */
const logResponse = (endpoint, data) => {
  if (!DEBUG_MODE) return;
  debugLog(endpoint, data, 'response');
};

/**
 * Log error information
 * @param {string} endpoint - The API endpoint being called
 * @param {Error} error - Error object
 */
const logError = (endpoint, error) => {
  if (!DEBUG_MODE) return;
  
  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code
  };
  
  debugLog(endpoint, errorData, 'error');
};

module.exports = {
  debugLog,
  logRequest,
  logResponse,
  logError
};