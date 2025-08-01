// Production configuration for Eventloo
const productionConfig = {
  // API Configuration
  API_BASE_URL: process.env.REACT_APP_API_URL || 'https://eventloo-backend-7vxrwvifna-uc.a.run.app/api',
  
  // Frontend URL
  FRONTEND_URL: process.env.REACT_APP_FRONTEND_URL || 'https://eventloo-frontend-326693416937.us-central1.run.app',
  
  // Feature flags
  ENABLE_DEBUG: process.env.REACT_APP_ENABLE_DEBUG === 'true',
  ENABLE_ANALYTICS: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
  
  // Timeout settings
  API_TIMEOUT: parseInt(process.env.REACT_APP_API_TIMEOUT) || 10000,
  
  // CORS settings
  CORS_CREDENTIALS: false,
  
  // Logging
  LOG_LEVEL: process.env.REACT_APP_LOG_LEVEL || 'error',
};

export default productionConfig; 