// Local development configuration for Eventloo
const productionConfig = {
  // API Configuration - pointing to local backend
  API_BASE_URL: 'http://localhost:8000',
  
  // Frontend URL
  FRONTEND_URL: 'http://localhost:3000',
  
  // Feature flags
  ENABLE_DEBUG: true,
  ENABLE_ANALYTICS: false,
  
  // Timeout settings
  API_TIMEOUT: 10000,
  
  // CORS settings
  CORS_CREDENTIALS: true,
  
  // Logging
  LOG_LEVEL: 'debug',
};

export default productionConfig; 