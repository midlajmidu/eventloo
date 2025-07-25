// Security Configuration for Eventloo
export const SECURITY_CONFIG = {
  // Authentication
  TOKEN_KEY: 'access_token',
  REFRESH_TOKEN_KEY: 'refresh_token',
  USER_ROLE_KEY: 'user_role',
  
  // Session Management
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  TOKEN_EXPIRY_WARNING: 5 * 60 * 1000, // 5 minutes before expiry
  
  // Password Policy
  MIN_PASSWORD_LENGTH: 8,
  REQUIRE_SPECIAL_CHAR: false,
  REQUIRE_NUMBER: false,
  REQUIRE_UPPERCASE: false,
  
  // Rate Limiting
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  
  // Data Validation
  MAX_STRING_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  
  // Allowed File Types
  ALLOWED_IMAGE_TYPES: ['jpg', 'jpeg', 'png', 'gif'],
  ALLOWED_DOCUMENT_TYPES: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
  
  // Input Sanitization
  SANITIZE_HTML: true,
  ALLOW_HTML_TAGS: ['b', 'i', 'u', 'strong', 'em'],
  
  // CORS Settings
  ALLOWED_ORIGINS: ['http://localhost:3000', 'http://localhost:8000'],
  
  // API Security
  API_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

// Security utility functions
export const SecurityUtils = {
  // Token management
  getToken: () => localStorage.getItem(SECURITY_CONFIG.TOKEN_KEY),
  setToken: (token) => localStorage.setItem(SECURITY_CONFIG.TOKEN_KEY, token),
  removeToken: () => localStorage.removeItem(SECURITY_CONFIG.TOKEN_KEY),
  
  // User role management
  getUserRole: () => localStorage.getItem(SECURITY_CONFIG.USER_ROLE_KEY),
  setUserRole: (role) => localStorage.setItem(SECURITY_CONFIG.USER_ROLE_KEY, role),
  removeUserRole: () => localStorage.removeItem(SECURITY_CONFIG.USER_ROLE_KEY),
  
  // Session management
  isSessionValid: () => {
    const token = SecurityUtils.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000;
      return Date.now() < expiry;
    } catch (error) {
      return false;
    }
  },
  
  // Logout
  logout: () => {
    SecurityUtils.removeToken();
    SecurityUtils.removeUserRole();
    localStorage.removeItem(SECURITY_CONFIG.REFRESH_TOKEN_KEY);
    window.location.href = '/login';
  },
  
  // Input validation
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    
    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .trim();
  },
  
  // Password validation
  validatePassword: (password) => {
    const errors = [];
    
    if (password.length < SECURITY_CONFIG.MIN_PASSWORD_LENGTH) {
      errors.push(`Password must be at least ${SECURITY_CONFIG.MIN_PASSWORD_LENGTH} characters long`);
    }
    
    if (SECURITY_CONFIG.REQUIRE_SPECIAL_CHAR && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    if (SECURITY_CONFIG.REQUIRE_NUMBER && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (SECURITY_CONFIG.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },
  
  // File validation
  validateFile: (file) => {
    const errors = [];
    
    if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
      errors.push(`File size must be less than ${SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
    
    const extension = file.name.split('.').pop().toLowerCase();
    const allowedTypes = [...SECURITY_CONFIG.ALLOWED_IMAGE_TYPES, ...SECURITY_CONFIG.ALLOWED_DOCUMENT_TYPES];
    
    if (!allowedTypes.includes(extension)) {
      errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}; 