import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  ErrorType, 
  ErrorCategory, 
  RetryStrategy, 
  getErrorClassification, 
  classifyError,
  ERROR_CLASSIFICATIONS 
} from '../../src/types/ErrorTypes';
import { RetryStrategyManager, SpecializedRetryStrategies } from '../../src/utils/RetryStrategy';
import { Logger } from '../../src/core/Logger';

describe('Error Type Classification', () => {
  describe('ErrorType enum', () => {
    it('should have all required error types', () => {
      expect(ErrorType.NETWORK_ERROR).toBe('network_error');
      expect(ErrorType.LOGIN_FAILED).toBe('login_failed');
      expect(ErrorType.CLASS_NOT_FOUND).toBe('class_not_found');
      expect(ErrorType.TIMING_ERROR).toBe('timing_error');
      expect(ErrorType.BROWSER_ERROR).toBe('browser_error');
      expect(ErrorType.CONFIG_ERROR).toBe('config_error');
      expect(ErrorType.UNKNOWN_ERROR).toBe('unknown_error');
    });
  });

  describe('Error Classification', () => {
    it('should classify network errors correctly', () => {
      const classification = getErrorClassification(ErrorType.NETWORK_ERROR);
      
      expect(classification.category).toBe(ErrorCategory.NETWORK);
      expect(classification.retryStrategy).toBe(RetryStrategy.EXPONENTIAL_BACKOFF);
      expect(classification.maxRetries).toBe(3);
      expect(classification.isCritical).toBe(false);
    });

    it('should classify authentication errors correctly', () => {
      const classification = getErrorClassification(ErrorType.INVALID_CREDENTIALS);
      
      expect(classification.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(classification.retryStrategy).toBe(RetryStrategy.NO_RETRY);
      expect(classification.maxRetries).toBe(0);
      expect(classification.isCritical).toBe(true);
    });

    it('should classify timing errors correctly', () => {
      const classification = getErrorClassification(ErrorType.TIMING_ERROR);
      
      expect(classification.category).toBe(ErrorCategory.TIMING);
      expect(classification.retryStrategy).toBe(RetryStrategy.NO_RETRY);
      expect(classification.isCritical).toBe(true);
    });

    it('should classify reservation errors correctly', () => {
      const noSpotsClassification = getErrorClassification(ErrorType.NO_SPOTS_AVAILABLE);
      expect(noSpotsClassification.category).toBe(ErrorCategory.RESERVATION);
      expect(noSpotsClassification.retryStrategy).toBe(RetryStrategy.NO_RETRY);
      expect(noSpotsClassification.isCritical).toBe(false);

      const alreadyBookedClassification = getErrorClassification(ErrorType.CLASS_ALREADY_BOOKED);
      expect(alreadyBookedClassification.category).toBe(ErrorCategory.RESERVATION);
      expect(alreadyBookedClassification.isCritical).toBe(false);
    });
  });

  describe('Error Classification by Message', () => {
    it('should classify network error messages', () => {
      expect(classifyError('Network connection failed')).toBe(ErrorType.NETWORK_ERROR);
      expect(classifyError('Connection timeout occurred')).toBe(ErrorType.CONNECTION_TIMEOUT);
      expect(classifyError('DNS resolution failed')).toBe(ErrorType.DNS_RESOLUTION_FAILED);
    });

    it('should classify authentication error messages', () => {
      expect(classifyError('Login failed')).toBe(ErrorType.LOGIN_FAILED);
      expect(classifyError('Invalid credentials provided')).toBe(ErrorType.INVALID_CREDENTIALS);
      expect(classifyError('Session expired')).toBe(ErrorType.SESSION_EXPIRED);
    });

    it('should classify UI error messages', () => {
      expect(classifyError('Element not found')).toBe(ErrorType.ELEMENT_NOT_FOUND);
      expect(classifyError('Page load timeout')).toBe(ErrorType.PAGE_LOAD_TIMEOUT);
      expect(classifyError('Modal did not open')).toBe(ErrorType.MODAL_NOT_OPENED);
    });

    it('should classify class/reservation error messages', () => {
      expect(classifyError('Class not found in schedule')).toBe(ErrorType.CLASS_NOT_FOUND);
      expect(classifyError('Capacidad completa')).toBe(ErrorType.NO_SPOTS_AVAILABLE);
      expect(classifyError('Class already booked')).toBe(ErrorType.CLASS_ALREADY_BOOKED);
    });

    it('should classify browser error messages', () => {
      expect(classifyError('Browser crashed')).toBe(ErrorType.BROWSER_CRASH);
      expect(classifyError('Chromium launch failed')).toBe(ErrorType.BROWSER_LAUNCH_FAILED);
      expect(classifyError('Browser error occurred')).toBe(ErrorType.BROWSER_ERROR);
    });

    it('should classify timing error messages', () => {
      expect(classifyError('Timing error detected')).toBe(ErrorType.TIMING_ERROR);
      expect(classifyError('Preparation timeout')).toBe(ErrorType.PREPARATION_TIMEOUT);
      expect(classifyError('Execution too late')).toBe(ErrorType.EXECUTION_TOO_LATE);
    });

    it('should default to unknown error for unrecognized messages', () => {
      expect(classifyError('Some random error message')).toBe(ErrorType.UNKNOWN_ERROR);
      expect(classifyError('')).toBe(ErrorType.UNKNOWN_ERROR);
    });
  });

  describe('Error Classifications Completeness', () => {
    it('should have classification for every error type', () => {
      const errorTypes = Object.values(ErrorType);
      const classificationKeys = Object.keys(ERROR_CLASSIFICATIONS);
      
      expect(classificationKeys.length).toBe(errorTypes.length);
      
      errorTypes.forEach(errorType => {
        expect(ERROR_CLASSIFICATIONS[errorType]).toBeDefined();
        expect(ERROR_CLASSIFICATIONS[errorType].type).toBe(errorType);
      });
    });

    it('should have valid retry strategies for all classifications', () => {
      const validStrategies = Object.values(RetryStrategy);
      
      Object.values(ERROR_CLASSIFICATIONS).forEach(classification => {
        expect(validStrategies).toContain(classification.retryStrategy);
        expect(classification.maxRetries).toBeGreaterThanOrEqual(0);
        expect(classification.retryDelayMs).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have descriptions and examples for all classifications', () => {
      Object.values(ERROR_CLASSIFICATIONS).forEach(classification => {
        expect(classification.description).toBeTruthy();
        expect(classification.examples).toBeInstanceOf(Array);
        expect(classification.examples.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Retry Strategy Manager', () => {
  let logger: Logger;
  let retryManager: RetryStrategyManager;

  beforeEach(() => {
    logger = new Logger();
    vi.spyOn(logger, 'logInfo').mockImplementation(() => {});
    vi.spyOn(logger, 'logError').mockImplementation(() => {});
    retryManager = new RetryStrategyManager(logger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await retryManager.executeWithRetry(operation, 'test operation');
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on recoverable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network connection failed'))
        .mockResolvedValue('success');
      
      const result = await retryManager.executeWithRetry(operation, 'test operation');
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-recoverable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
      
      const result = await retryManager.executeWithRetry(operation, 'test operation');
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const result = await retryManager.executeWithRetry(
        operation, 
        'test operation',
        { maxRetries: 2 }
      );
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // Initial + 2 retries
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should apply exponential backoff delay', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'));
      const startTime = Date.now();
      
      await retryManager.executeWithRetry(
        operation,
        'test operation',
        { maxRetries: 2, baseDelayMs: 100, jitterMs: 0 }
      );
      
      const duration = Date.now() - startTime;
      // Should have delays: 100ms + 200ms = 300ms minimum
      expect(duration).toBeGreaterThan(250);
    });

    it('should handle timeout correctly', async () => {
      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      const result = await retryManager.executeWithRetry(
        operation,
        'test operation',
        { timeoutMs: 500 }
      );
      
      expect(result.success).toBe(false);
    });
  });

  describe('executeTimingCritical', () => {
    it('should execute immediately if within timing window', async () => {
      const targetTime = new Date(Date.now() + 1000); // 1 second in future
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await retryManager.executeTimingCritical(
        operation,
        'timing critical operation',
        targetTime
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should fail if too late for timing window', async () => {
      const targetTime = new Date(Date.now() - 2000); // 2 seconds in past
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await retryManager.executeTimingCritical(
        operation,
        'timing critical operation',
        targetTime,
        1000 // 1 second max latency
      );
      
      expect(result.success).toBe(false);
      expect(operation).not.toHaveBeenCalled();
    });

    it('should retry once if there is time remaining', async () => {
      const targetTime = new Date(Date.now() + 2000); // 2 seconds in future
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue('success');
      
      const result = await retryManager.executeTimingCritical(
        operation,
        'timing critical operation',
        targetTime
      );
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });
});

describe('Specialized Retry Strategies', () => {
  let logger: Logger;
  let strategies: SpecializedRetryStrategies;

  beforeEach(() => {
    logger = new Logger();
    vi.spyOn(logger, 'logInfo').mockImplementation(() => {});
    vi.spyOn(logger, 'logError').mockImplementation(() => {});
    strategies = new SpecializedRetryStrategies(logger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use appropriate retry settings for network operations', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValue('success');
    
    const result = await strategies.retryNetworkOperation(operation, 'network test');
    
    expect(result.success).toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should use appropriate retry settings for UI operations', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Element not found'))
      .mockResolvedValue('success');
    
    const result = await strategies.retryUIOperation(operation, 'UI test');
    
    expect(result.success).toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should use limited retries for auth operations', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Session expired'));
    
    const result = await strategies.retryAuthOperation(operation, 'auth test');
    
    expect(result.success).toBe(false);
    expect(operation).toHaveBeenCalledTimes(2); // Initial + 1 retry max
  });

  it('should handle timing critical operations with special logic', async () => {
    const targetTime = new Date(Date.now() + 1000);
    const operation = vi.fn().mockResolvedValue('success');
    
    const result = await strategies.retryTimingCritical(
      operation,
      'timing test',
      targetTime
    );
    
    expect(result.success).toBe(true);
  });

  it('should retry browser operations with appropriate delays', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Browser crash'))
      .mockResolvedValue('success');
    
    const result = await strategies.retryBrowserOperation(operation, 'browser test');
    
    expect(result.success).toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe('Error Handling Edge Cases', () => {
  let logger: Logger;
  let retryManager: RetryStrategyManager;

  beforeEach(() => {
    logger = new Logger();
    vi.spyOn(logger, 'logInfo').mockImplementation(() => {});
    vi.spyOn(logger, 'logError').mockImplementation(() => {});
    retryManager = new RetryStrategyManager(logger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle undefined errors gracefully', async () => {
    const operation = vi.fn().mockRejectedValue(undefined);
    
    const result = await retryManager.executeWithRetry(operation, 'undefined error test');
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle null errors gracefully', async () => {
    const operation = vi.fn().mockRejectedValue(null);
    
    const result = await retryManager.executeWithRetry(operation, 'null error test');
    
    expect(result.success).toBe(false);
  });

  it('should handle non-Error objects', async () => {
    const operation = vi.fn().mockRejectedValue('string error');
    
    const result = await retryManager.executeWithRetry(operation, 'string error test');
    
    expect(result.success).toBe(false);
  });

  it('should handle operations that throw synchronously', async () => {
    const operation = vi.fn().mockImplementation(() => {
      throw new Error('Synchronous error');
    });
    
    const result = await retryManager.executeWithRetry(operation, 'sync error test');
    
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Synchronous error');
  });

  it('should handle very long error messages', async () => {
    const longMessage = 'A'.repeat(10000);
    const operation = vi.fn().mockRejectedValue(new Error(longMessage));
    
    const result = await retryManager.executeWithRetry(operation, 'long message test');
    
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe(longMessage);
  });

  it('should handle operations that succeed after many failures', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Network error 1'))
      .mockRejectedValueOnce(new Error('Network error 2'))
      .mockRejectedValueOnce(new Error('Network error 3'))
      .mockResolvedValue('finally success');
    
    const result = await retryManager.executeWithRetry(
      operation,
      'persistent failure test',
      { maxRetries: 5 }
    );
    
    expect(result.success).toBe(true);
    expect(result.result).toBe('finally success');
    expect(result.attempts).toBe(4);
  });
});