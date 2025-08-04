import productionConfig from '../config/production';

// API Utilities for handling URL issues

/**
 * Ensures the API URL is always HTTP for localhost development
 * This prevents Chrome from trying to use HTTPS
 */
export const getApiBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  
  if (envUrl) {
    // If environment variable is set, use it but ensure HTTP for localhost
    if (envUrl.includes('localhost') && envUrl.startsWith('https://')) {
      return envUrl.replace('https://', 'http://');
    }
    // Remove trailing slash if present
    return envUrl.replace(/\/$/, '');
  }
  
  // In production, use Render backend URL as default
  if (process.env.NODE_ENV === 'production') {
    const renderUrl = process.env.REACT_APP_API_URL || 'https://eventloo-backend-qkvm.onrender.com';
    return renderUrl.replace(/\/$/, '');
  }
  
  // Default to HTTP localhost for development
  return 'http://localhost:8000';
};

/**
 * Creates a safe API URL that prevents HTTPS issues
 */
export const createSafeApiUrl = (endpoint) => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Check if base URL already has /api
  if (baseUrl.includes('/api')) {
    return `${baseUrl}${cleanEndpoint}`;
  } else {
    // Add /api to the base URL
    return `${baseUrl}/api${cleanEndpoint}`;
  }
};

/**
 * Gets the API base URL with /api included
 */
export const getApiBaseUrlWithApi = () => {
  const baseUrl = getApiBaseUrl();
  
  // Check if base URL already has /api
  if (baseUrl.includes('/api')) {
    return baseUrl;
  } else {
    // Add /api to the base URL
    return `${baseUrl}/api`;
  }
};

/**
 * Debug function to log API configuration
 */
export const debugApiConfig = () => {
  console.log('🔧 API Configuration Debug:');
  console.log('  - Environment:', process.env.NODE_ENV);
  console.log('  - REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
  console.log('  - Computed Base URL:', getApiBaseUrl());
  console.log('  - Base URL with API:', getApiBaseUrlWithApi());
  console.log('  - Current Location:', window.location.href);
  console.log('  - Protocol:', window.location.protocol);
  console.log('  - Production Config:', productionConfig);
};

/**
 * Check if we're in development mode
 */
export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Check if we're running on localhost
 */
export const isLocalhost = () => {
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1';
};

/**
 * Get API timeout from config
 */
export const getApiTimeout = () => {
  return productionConfig.API_TIMEOUT;
}; 