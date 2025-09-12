/**
 * Comprehensive error type classification for CrossFit Reservation Bot
 * Each error type includes category, retry strategy, and context information
 */

export enum ErrorType {
  // Network and Connection Errors
  NETWORK_ERROR = 'network_error',
  CONNECTION_TIMEOUT = 'connection_timeout',
  DNS_RESOLUTION_FAILED = 'dns_resolution_failed',
  SSL_CERTIFICATE_ERROR = 'ssl_certificate_error',
  
  // Authentication and Session Errors
  LOGIN_FAILED = 'login_failed',
  INVALID_CREDENTIALS = 'invalid_credentials',
  SESSION_EXPIRED = 'session_expired',
  ACCOUNT_LOCKED = 'account_locked',
  TWO_FACTOR_REQUIRED = 'two_factor_required',
  
  // UI and Navigation Errors
  ELEMENT_NOT_FOUND = 'element_not_found',
  PAGE_LOAD_TIMEOUT = 'page_load_timeout',
  UNEXPECTED_POPUP = 'unexpected_popup',
  LAYOUT_CHANGED = 'layout_changed',
  MODAL_NOT_OPENED = 'modal_not_opened',
  BUTTON_NOT_CLICKABLE = 'button_not_clickable',
  
  // Class and Reservation Errors
  CLASS_NOT_FOUND = 'class_not_found',
  NO_SPOTS_AVAILABLE = 'no_spots_available',
  CLASS_ALREADY_BOOKED = 'class_already_booked',
  CLASS_CANCELLED = 'class_cancelled',
  RESERVATION_WINDOW_CLOSED = 'reservation_window_closed',
  RESERVE_BUTTON_NOT_FOUND = 'reserve_button_not_found',
  
  // Timing Critical Errors
  TIMING_ERROR = 'timing_error',
  PREPARATION_TIMEOUT = 'preparation_timeout',
  EXECUTION_TOO_LATE = 'execution_too_late',
  CLOCK_DRIFT_DETECTED = 'clock_drift_detected',
  
  // Browser and System Errors
  BROWSER_ERROR = 'browser_error',
  BROWSER_CRASH = 'browser_crash',
  MEMORY_LIMIT_EXCEEDED = 'memory_limit_exceeded',
  BROWSER_LAUNCH_FAILED = 'browser_launch_failed',
  
  // Configuration and Environment Errors
  CONFIG_ERROR = 'config_error',
  MISSING_ENVIRONMENT_VARIABLE = 'missing_environment_variable',
  INVALID_SCHEDULE_CONFIG = 'invalid_schedule_config',
  TIMEZONE_ERROR = 'timezone_error',
  
  // External Service Errors
  WEBHOOK_ERROR = 'webhook_error',
  NOTIFICATION_FAILED = 'notification_failed',
  
  // Unknown and Unexpected Errors
  UNKNOWN_ERROR = 'unknown_error',
  UNEXPECTED_ERROR = 'unexpected_error'
}

export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication', 
  UI_NAVIGATION = 'ui_navigation',
  RESERVATION = 'reservation',
  TIMING = 'timing',
  BROWSER = 'browser',
  CONFIGURATION = 'configuration',
  EXTERNAL_SERVICE = 'external_service',
  UNKNOWN = 'unknown'
}

export enum RetryStrategy {
  NO_RETRY = 'no_retry',
  IMMEDIATE_RETRY = 'immediate_retry',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR_BACKOFF = 'linear_backoff',
  TIMING_CRITICAL_RETRY = 'timing_critical_retry'
}

export interface ErrorClassification {
  type: ErrorType;
  category: ErrorCategory;
  retryStrategy: RetryStrategy;
  maxRetries: number;
  retryDelayMs: number;
  isCritical: boolean;
  description: string;
  examples: string[];
  context?: string;
}

/**
 * Comprehensive error classification mapping
 * Maps each error type to its category, retry strategy, and metadata
 */
export const ERROR_CLASSIFICATIONS: Record<ErrorType, ErrorClassification> = {
  // Network and Connection Errors
  [ErrorType.NETWORK_ERROR]: {
    type: ErrorType.NETWORK_ERROR,
    category: ErrorCategory.NETWORK,
    retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    maxRetries: 3,
    retryDelayMs: 1000,
    isCritical: false,
    description: 'General network connectivity issues',
    examples: ['Connection refused', 'Network unreachable', 'Request timeout'],
    context: 'Usually temporary network issues that can be resolved with retry'
  },
  
  [ErrorType.CONNECTION_TIMEOUT]: {
    type: ErrorType.CONNECTION_TIMEOUT,
    category: ErrorCategory.NETWORK,
    retryStrategy: RetryStrategy.LINEAR_BACKOFF,
    maxRetries: 2,
    retryDelayMs: 2000,
    isCritical: false,
    description: 'Connection timeout to BoxMagic servers',
    examples: ['Request timeout after 30s', 'Server not responding'],
    context: 'May indicate server overload or network congestion'
  },
  
  [ErrorType.DNS_RESOLUTION_FAILED]: {
    type: ErrorType.DNS_RESOLUTION_FAILED,
    category: ErrorCategory.NETWORK,
    retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    maxRetries: 2,
    retryDelayMs: 5000,
    isCritical: false,
    description: 'DNS resolution failure for BoxMagic domain',
    examples: ['NXDOMAIN', 'DNS server not responding'],
    context: 'DNS issues are usually temporary but may indicate ISP problems'
  },
  
  [ErrorType.SSL_CERTIFICATE_ERROR]: {
    type: ErrorType.SSL_CERTIFICATE_ERROR,
    category: ErrorCategory.NETWORK,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'SSL certificate validation failed',
    examples: ['Certificate expired', 'Certificate mismatch', 'Untrusted certificate'],
    context: 'SSL errors usually require manual intervention or indicate security issues'
  },
  
  // Authentication and Session Errors
  [ErrorType.LOGIN_FAILED]: {
    type: ErrorType.LOGIN_FAILED,
    category: ErrorCategory.AUTHENTICATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Login process failed',
    examples: ['Login form not found', 'Submit button not working', 'Unexpected redirect'],
    context: 'Login failures may indicate UI changes or credential issues'
  },
  
  [ErrorType.INVALID_CREDENTIALS]: {
    type: ErrorType.INVALID_CREDENTIALS,
    category: ErrorCategory.AUTHENTICATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Invalid email or password',
    examples: ['Incorrect email/password message', 'Authentication failed'],
    context: 'Requires updating credentials in configuration'
  },
  
  [ErrorType.SESSION_EXPIRED]: {
    type: ErrorType.SESSION_EXPIRED,
    category: ErrorCategory.AUTHENTICATION,
    retryStrategy: RetryStrategy.IMMEDIATE_RETRY,
    maxRetries: 1,
    retryDelayMs: 0,
    isCritical: false,
    description: 'User session expired during operation',
    examples: ['Redirected to login page', 'Session timeout message'],
    context: 'Can be resolved by re-authenticating'
  },
  
  [ErrorType.ACCOUNT_LOCKED]: {
    type: ErrorType.ACCOUNT_LOCKED,
    category: ErrorCategory.AUTHENTICATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'User account is locked or suspended',
    examples: ['Account locked message', 'Too many failed attempts'],
    context: 'Requires manual account recovery'
  },
  
  [ErrorType.TWO_FACTOR_REQUIRED]: {
    type: ErrorType.TWO_FACTOR_REQUIRED,
    category: ErrorCategory.AUTHENTICATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Two-factor authentication required',
    examples: ['2FA prompt appeared', 'SMS code required'],
    context: 'Bot cannot handle 2FA automatically'
  },
  
  // UI and Navigation Errors
  [ErrorType.ELEMENT_NOT_FOUND]: {
    type: ErrorType.ELEMENT_NOT_FOUND,
    category: ErrorCategory.UI_NAVIGATION,
    retryStrategy: RetryStrategy.LINEAR_BACKOFF,
    maxRetries: 2,
    retryDelayMs: 1000,
    isCritical: false,
    description: 'Expected UI element not found',
    examples: ['Button selector not found', 'Form field missing', 'Link not present'],
    context: 'May indicate page loading issues or UI changes'
  },
  
  [ErrorType.PAGE_LOAD_TIMEOUT]: {
    type: ErrorType.PAGE_LOAD_TIMEOUT,
    category: ErrorCategory.UI_NAVIGATION,
    retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    maxRetries: 2,
    retryDelayMs: 3000,
    isCritical: false,
    description: 'Page failed to load within timeout',
    examples: ['Page load timeout after 30s', 'Navigation timeout'],
    context: 'Usually indicates slow server response or network issues'
  },
  
  [ErrorType.UNEXPECTED_POPUP]: {
    type: ErrorType.UNEXPECTED_POPUP,
    category: ErrorCategory.UI_NAVIGATION,
    retryStrategy: RetryStrategy.IMMEDIATE_RETRY,
    maxRetries: 1,
    retryDelayMs: 0,
    isCritical: false,
    description: 'Unexpected popup or modal appeared',
    examples: ['Maintenance notice', 'Cookie consent', 'Advertisement popup'],
    context: 'Can usually be handled by closing the popup and retrying'
  },
  
  [ErrorType.LAYOUT_CHANGED]: {
    type: ErrorType.LAYOUT_CHANGED,
    category: ErrorCategory.UI_NAVIGATION,
    retryStrategy: RetryStrategy.LINEAR_BACKOFF,
    maxRetries: 1,
    retryDelayMs: 2000,
    isCritical: false,
    description: 'Page layout or structure changed',
    examples: ['Selector no longer works', 'Element moved', 'New UI version'],
    context: 'May require updating selectors or handling new UI patterns'
  },
  
  [ErrorType.MODAL_NOT_OPENED]: {
    type: ErrorType.MODAL_NOT_OPENED,
    category: ErrorCategory.UI_NAVIGATION,
    retryStrategy: RetryStrategy.IMMEDIATE_RETRY,
    maxRetries: 1,
    retryDelayMs: 500,
    isCritical: true,
    description: 'Class modal failed to open when clicked',
    examples: ['Modal selector not found after click', 'Class click had no effect'],
    context: 'Critical for reservation process - may indicate class unavailability'
  },
  
  [ErrorType.BUTTON_NOT_CLICKABLE]: {
    type: ErrorType.BUTTON_NOT_CLICKABLE,
    category: ErrorCategory.UI_NAVIGATION,
    retryStrategy: RetryStrategy.LINEAR_BACKOFF,
    maxRetries: 2,
    retryDelayMs: 1000,
    isCritical: false,
    description: 'Button exists but is not clickable',
    examples: ['Button disabled', 'Button covered by overlay', 'Button not visible'],
    context: 'May require scrolling, waiting, or handling overlays'
  },
  
  // Class and Reservation Errors
  [ErrorType.CLASS_NOT_FOUND]: {
    type: ErrorType.CLASS_NOT_FOUND,
    category: ErrorCategory.RESERVATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Target class not found in schedule',
    examples: ['Class name not in list', 'Schedule empty', 'Wrong day selected'],
    context: 'May indicate class cancellation or schedule changes'
  },
  
  [ErrorType.NO_SPOTS_AVAILABLE]: {
    type: ErrorType.NO_SPOTS_AVAILABLE,
    category: ErrorCategory.RESERVATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: false,
    description: 'Class is full - no spots available',
    examples: ['Capacidad completa', 'No spaces left', 'Waitlist only'],
    context: 'Expected outcome when class fills up quickly'
  },
  
  [ErrorType.CLASS_ALREADY_BOOKED]: {
    type: ErrorType.CLASS_ALREADY_BOOKED,
    category: ErrorCategory.RESERVATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: false,
    description: 'User already has this class booked',
    examples: ['Agendada status', 'Already registered message'],
    context: 'Successful outcome - reservation already exists'
  },
  
  [ErrorType.CLASS_CANCELLED]: {
    type: ErrorType.CLASS_CANCELLED,
    category: ErrorCategory.RESERVATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Class has been cancelled',
    examples: ['Class cancelled notice', 'Instructor unavailable'],
    context: 'Class will not happen - no reservation possible'
  },
  
  [ErrorType.RESERVATION_WINDOW_CLOSED]: {
    type: ErrorType.RESERVATION_WINDOW_CLOSED,
    category: ErrorCategory.RESERVATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Reservation window has closed',
    examples: ['Too late to book', 'Reservation deadline passed'],
    context: 'Timing was incorrect - reservation window missed'
  },
  
  [ErrorType.RESERVE_BUTTON_NOT_FOUND]: {
    type: ErrorType.RESERVE_BUTTON_NOT_FOUND,
    category: ErrorCategory.RESERVATION,
    retryStrategy: RetryStrategy.IMMEDIATE_RETRY,
    maxRetries: 1,
    retryDelayMs: 500,
    isCritical: true,
    description: 'Agendar button not found in modal',
    examples: ['Button selector failed', 'Modal content different'],
    context: 'Critical timing issue - may indicate UI changes or loading problems'
  },
  
  // Timing Critical Errors
  [ErrorType.TIMING_ERROR]: {
    type: ErrorType.TIMING_ERROR,
    category: ErrorCategory.TIMING,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'General timing precision error',
    examples: ['Execution too early/late', 'Clock synchronization issue'],
    context: 'Timing precision is critical for reservation success'
  },
  
  [ErrorType.PREPARATION_TIMEOUT]: {
    type: ErrorType.PREPARATION_TIMEOUT,
    category: ErrorCategory.TIMING,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Preparation phase took too long',
    examples: ['Login took >25s', 'Navigation timeout', 'Page load too slow'],
    context: 'Not enough time left for precise execution'
  },
  
  [ErrorType.EXECUTION_TOO_LATE]: {
    type: ErrorType.EXECUTION_TOO_LATE,
    category: ErrorCategory.TIMING,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Critical execution happened too late',
    examples: ['Clicked after target time', 'Spots already taken'],
    context: 'Timing precision failure - likely lost the reservation race'
  },
  
  [ErrorType.CLOCK_DRIFT_DETECTED]: {
    type: ErrorType.CLOCK_DRIFT_DETECTED,
    category: ErrorCategory.TIMING,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'System clock drift detected',
    examples: ['Time difference >1s from NTP', 'Clock synchronization lost'],
    context: 'System time is not accurate enough for precise timing'
  },
  
  // Browser and System Errors
  [ErrorType.BROWSER_ERROR]: {
    type: ErrorType.BROWSER_ERROR,
    category: ErrorCategory.BROWSER,
    retryStrategy: RetryStrategy.IMMEDIATE_RETRY,
    maxRetries: 1,
    retryDelayMs: 0,
    isCritical: false,
    description: 'General browser operation error',
    examples: ['Page crash', 'JavaScript error', 'Rendering issue'],
    context: 'Browser-specific issues that may be resolved by retry'
  },
  
  [ErrorType.BROWSER_CRASH]: {
    type: ErrorType.BROWSER_CRASH,
    category: ErrorCategory.BROWSER,
    retryStrategy: RetryStrategy.IMMEDIATE_RETRY,
    maxRetries: 1,
    retryDelayMs: 1000,
    isCritical: true,
    description: 'Browser process crashed',
    examples: ['Browser disconnected', 'Process terminated', 'Out of memory'],
    context: 'Requires restarting browser and full re-initialization'
  },
  
  [ErrorType.MEMORY_LIMIT_EXCEEDED]: {
    type: ErrorType.MEMORY_LIMIT_EXCEEDED,
    category: ErrorCategory.BROWSER,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'System memory limit exceeded',
    examples: ['Out of memory error', 'Memory allocation failed'],
    context: 'System resource limitation - may require environment optimization'
  },
  
  [ErrorType.BROWSER_LAUNCH_FAILED]: {
    type: ErrorType.BROWSER_LAUNCH_FAILED,
    category: ErrorCategory.BROWSER,
    retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    maxRetries: 2,
    retryDelayMs: 2000,
    isCritical: true,
    description: 'Failed to launch browser process',
    examples: ['Chromium not found', 'Permission denied', 'Launch timeout'],
    context: 'Environment or installation issue with browser'
  },
  
  // Configuration and Environment Errors
  [ErrorType.CONFIG_ERROR]: {
    type: ErrorType.CONFIG_ERROR,
    category: ErrorCategory.CONFIGURATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Configuration validation failed',
    examples: ['Invalid JSON', 'Missing required fields', 'Invalid format'],
    context: 'Configuration must be fixed before execution'
  },
  
  [ErrorType.MISSING_ENVIRONMENT_VARIABLE]: {
    type: ErrorType.MISSING_ENVIRONMENT_VARIABLE,
    category: ErrorCategory.CONFIGURATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Required environment variable missing',
    examples: ['BOXMAGIC_EMAIL not set', 'BOXMAGIC_PASSWORD missing'],
    context: 'Environment variables must be configured'
  },
  
  [ErrorType.INVALID_SCHEDULE_CONFIG]: {
    type: ErrorType.INVALID_SCHEDULE_CONFIG,
    category: ErrorCategory.CONFIGURATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Schedule configuration is invalid',
    examples: ['Invalid datetime format', 'Past reservation time', 'Invalid class name'],
    context: 'Schedule configuration needs correction'
  },
  
  [ErrorType.TIMEZONE_ERROR]: {
    type: ErrorType.TIMEZONE_ERROR,
    category: ErrorCategory.CONFIGURATION,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Timezone configuration error',
    examples: ['Invalid timezone string', 'Timezone conversion failed'],
    context: 'Timezone must be properly configured for accurate timing'
  },
  
  // External Service Errors
  [ErrorType.WEBHOOK_ERROR]: {
    type: ErrorType.WEBHOOK_ERROR,
    category: ErrorCategory.EXTERNAL_SERVICE,
    retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    maxRetries: 3,
    retryDelayMs: 1000,
    isCritical: false,
    description: 'Webhook notification failed',
    examples: ['HTTP 500 error', 'Webhook timeout', 'Invalid webhook URL'],
    context: 'Webhook failures should not interrupt main reservation process'
  },
  
  [ErrorType.NOTIFICATION_FAILED]: {
    type: ErrorType.NOTIFICATION_FAILED,
    category: ErrorCategory.EXTERNAL_SERVICE,
    retryStrategy: RetryStrategy.LINEAR_BACKOFF,
    maxRetries: 2,
    retryDelayMs: 2000,
    isCritical: false,
    description: 'General notification delivery failed',
    examples: ['Email failed', 'SMS failed', 'Push notification failed'],
    context: 'Notification failures are non-critical'
  },
  
  // Unknown and Unexpected Errors
  [ErrorType.UNKNOWN_ERROR]: {
    type: ErrorType.UNKNOWN_ERROR,
    category: ErrorCategory.UNKNOWN,
    retryStrategy: RetryStrategy.NO_RETRY,
    maxRetries: 0,
    retryDelayMs: 0,
    isCritical: true,
    description: 'Unknown error occurred',
    examples: ['Unhandled exception', 'Unexpected error type'],
    context: 'Requires investigation and potential code updates'
  },
  
  [ErrorType.UNEXPECTED_ERROR]: {
    type: ErrorType.UNEXPECTED_ERROR,
    category: ErrorCategory.UNKNOWN,
    retryStrategy: RetryStrategy.IMMEDIATE_RETRY,
    maxRetries: 1,
    retryDelayMs: 1000,
    isCritical: false,
    description: 'Unexpected but potentially recoverable error',
    examples: ['Transient error', 'Race condition', 'Temporary glitch'],
    context: 'May be resolved with a single retry'
  }
};

/**
 * Helper function to get error classification by error type
 */
export function getErrorClassification(errorType: ErrorType): ErrorClassification {
  return ERROR_CLASSIFICATIONS[errorType];
}

/**
 * Helper function to classify an error by its message or characteristics
 */
export function classifyError(error: Error | string): ErrorType {
  if (!error) {
    return ErrorType.UNKNOWN_ERROR;
  }
  
  let errorMessage: string;
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error.message) {
    errorMessage = error.message;
  } else {
    return ErrorType.UNKNOWN_ERROR;
  }
  
  const lowerMessage = errorMessage.toLowerCase();
  
  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
    if (lowerMessage.includes('timeout')) return ErrorType.CONNECTION_TIMEOUT;
    if (lowerMessage.includes('dns')) return ErrorType.DNS_RESOLUTION_FAILED;
    return ErrorType.NETWORK_ERROR;
  }
  
  // Authentication errors
  if (lowerMessage.includes('login') || lowerMessage.includes('auth')) {
    if (lowerMessage.includes('credential') || lowerMessage.includes('password')) {
      return ErrorType.INVALID_CREDENTIALS;
    }
    if (lowerMessage.includes('session') || lowerMessage.includes('expired')) {
      return ErrorType.SESSION_EXPIRED;
    }
    return ErrorType.LOGIN_FAILED;
  }
  
  // UI/Navigation errors
  if (lowerMessage.includes('element') || lowerMessage.includes('selector')) {
    return ErrorType.ELEMENT_NOT_FOUND;
  }
  if (lowerMessage.includes('timeout') && lowerMessage.includes('page')) {
    return ErrorType.PAGE_LOAD_TIMEOUT;
  }
  if (lowerMessage.includes('modal')) {
    return ErrorType.MODAL_NOT_OPENED;
  }
  
  // Class/Reservation errors
  if (lowerMessage.includes('class') || lowerMessage.includes('clase')) {
    if (lowerMessage.includes('not found') || lowerMessage.includes('no encontrada')) {
      return ErrorType.CLASS_NOT_FOUND;
    }
    if (lowerMessage.includes('booked') || lowerMessage.includes('agendada')) {
      return ErrorType.CLASS_ALREADY_BOOKED;
    }
  }
  
  // Check for capacity/spots separately to catch "Capacidad completa"
  if (lowerMessage.includes('capacidad completa') || 
      lowerMessage.includes('full') || 
      lowerMessage.includes('no spots')) {
    return ErrorType.NO_SPOTS_AVAILABLE;
  }
  
  // Browser errors
  if (lowerMessage.includes('browser') || lowerMessage.includes('chromium')) {
    if (lowerMessage.includes('crash') || lowerMessage.includes('disconnect')) {
      return ErrorType.BROWSER_CRASH;
    }
    if (lowerMessage.includes('launch') || lowerMessage.includes('start')) {
      return ErrorType.BROWSER_LAUNCH_FAILED;
    }
    return ErrorType.BROWSER_ERROR;
  }
  
  // Timing errors - check specific patterns first
  if (lowerMessage.includes('preparation') && lowerMessage.includes('timeout')) {
    return ErrorType.PREPARATION_TIMEOUT;
  }
  if (lowerMessage.includes('execution') && lowerMessage.includes('late')) {
    return ErrorType.EXECUTION_TOO_LATE;
  }
  if (lowerMessage.includes('timing') || 
      (lowerMessage.includes('time') && lowerMessage.includes('error'))) {
    return ErrorType.TIMING_ERROR;
  }
  
  // Configuration errors
  if (lowerMessage.includes('config') || lowerMessage.includes('environment')) {
    return ErrorType.CONFIG_ERROR;
  }
  
  // Default to unknown error
  return ErrorType.UNKNOWN_ERROR;
}