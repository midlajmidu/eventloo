// API Utilities for local development

/**
 * Gets the base URL for API requests
 * Always returns the local development URL
 */
export const getApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_URL;
  if (configured !== undefined && configured !== null && configured !== '') {
    return configured.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:8002';
  }
  // In single-container / same-origin deployments, use relative URL
  return '';
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
    return `${baseUrl}/api/`;
  }
};

/**
 * Debug function to log API configuration
 */
export const debugApiConfig = () => {
  if (import.meta.env.DEV) {
    console.debug('API base URL:', getApiBaseUrlWithApi());
  }
};

/**
 * Always return true for development mode
 */
export const isDevelopment = () => {
  return import.meta.env.DEV;
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
  return 15000;
}; 
