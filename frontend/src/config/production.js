// Production Configuration
export const PRODUCTION_CONFIG = {
  // API Configuration
  API_BASE_URL: 'http://localhost:8000/api',
  
  // App Configuration
  APP_NAME: 'Eventloo',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'School Event Management System',
  
  // Security Configuration
  TOKEN_EXPIRY_WARNING: 5 * 60 * 1000, // 5 minutes before expiry
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  
  // Feature Flags
  ENABLE_DEMO_ACCOUNTS: false, // Disable demo accounts in production
  ENABLE_DEBUG_MODE: false,
  ENABLE_ANALYTICS: false,
  
  // File Upload Limits
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
  
  // Pagination Defaults
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  
  // Export Limits
  MAX_EXPORT_RECORDS: 1000,
  
  // Error Reporting
  ENABLE_ERROR_REPORTING: true,
  ERROR_REPORTING_URL: null, // Add your error reporting service URL
  
  // Performance
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  DEBOUNCE_DELAY: 300, // 300ms
}; 