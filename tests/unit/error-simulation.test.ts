import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorType, classifyError } from '../../src/types/ErrorTypes';
import { RetryStrategyManager } from '../../src/utils/RetryStrategy';
import { Logger } from '../../src/core/Logger';

/**
 * Test suite for simulating various error conditions and validating
 * error handling behavior across different scenarios
 */

describe('Error Simulation and Handling', () => {
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

  describe('Network Error Simulations', () => {
    it('should handle connection timeout errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Connection timeout after 30000ms')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'network timeout test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.CONNECTION_TIMEOUT);
      expect(mockOperation).toHaveBeenCalledTimes(3); // Should retry for network errors
    });

    it('should handle DNS resolution failures', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('DNS resolution failed for members.boxmagic.app')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'DNS failure test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.DNS_RESOLUTION_FAILED);
    });

    it('should handle SSL certificate errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('SSL certificate verification failed')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'SSL error test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.NETWORK_ERROR);
      expect(mockOperation).toHaveBeenCalledTimes(1); // SSL errors should not retry
    });

    it('should handle intermittent network failures', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Network connection temporarily unavailable');
        }
        return 'success';
      });

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'intermittent network test'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(attemptCount).toBe(3);
    });
  });

  describe('Authentication Error Simulations', () => {
    it('should handle invalid credentials', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Invalid email or password provided')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'invalid credentials test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.INVALID_CREDENTIALS);
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should handle session expiration with retry', async () => {
      let sessionExpired = true;
      const mockOperation = vi.fn().mockImplementation(() => {
        if (sessionExpired) {
          sessionExpired = false; // Simulate re-authentication
          throw new Error('Session expired - please login again');
        }
        return 'success after re-auth';
      });

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'session expiration test'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('success after re-auth');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should handle account locked scenarios', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Account locked due to too many failed attempts')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'account locked test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.LOGIN_FAILED);
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should handle two-factor authentication requirements', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Two-factor authentication code required')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        '2FA required test'
      );

      expect(result.success).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(1); // Cannot handle 2FA automatically
    });
  });

  describe('UI Navigation Error Simulations', () => {
    it('should handle element not found with retries', async () => {
      let elementFound = false;
      const mockOperation = vi.fn().mockImplementation(() => {
        if (!elementFound) {
          elementFound = true; // Simulate element appearing after retry
          throw new Error('Element with selector "text=Agendar" not found');
        }
        return 'element found';
      });

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'element not found test'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('element found');
    });

    it('should handle page load timeouts', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Page load timeout after 30000ms')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'page load timeout test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.PAGE_LOAD_TIMEOUT);
    });

    it('should handle unexpected popups', async () => {
      let popupHandled = false;
      const mockOperation = vi.fn().mockImplementation(() => {
        if (!popupHandled) {
          popupHandled = true;
          throw new Error('Unexpected popup blocked the operation');
        }
        return 'popup handled, operation successful';
      });

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'unexpected popup test'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('popup handled, operation successful');
    });

    it('should handle layout changes', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Layout changed - selector no longer valid')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'layout change test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.UNKNOWN_ERROR);
    });
  });

  describe('Class and Reservation Error Simulations', () => {
    it('should handle class not found scenarios', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Class "METCON" not found in schedule')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'class not found test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.CLASS_NOT_FOUND);
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should handle no spots available', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Capacidad completa - no spots available')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'no spots test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.NO_SPOTS_AVAILABLE);
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should handle already booked classes', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Class already booked - status shows Agendada')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'already booked test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.CLASS_ALREADY_BOOKED);
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should handle class cancellation', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Class has been cancelled by instructor')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'class cancelled test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.UNKNOWN_ERROR);
    });

    it('should handle reservation window closed', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Reservation window has closed - too late to book')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'reservation window closed test'
      );

      expect(result.success).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry
    });
  });

  describe('Timing Critical Error Simulations', () => {
    it('should handle timing errors in critical operations', async () => {
      const targetTime = new Date(Date.now() + 1000);
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Timing error - execution too late')
      );

      const result = await retryManager.executeTimingCritical(
        mockOperation,
        'timing critical test',
        targetTime
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.EXECUTION_TOO_LATE);
    });

    it('should handle preparation timeout', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Preparation timeout - login took too long')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'preparation timeout test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.PREPARATION_TIMEOUT);
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry timing errors
    });

    it('should handle clock drift detection', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Clock drift detected - system time inaccurate')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'clock drift test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.TIMING_ERROR);
    });
  });

  describe('Browser Error Simulations', () => {
    it('should handle browser crashes with retry', async () => {
      let browserCrashed = true;
      const mockOperation = vi.fn().mockImplementation(() => {
        if (browserCrashed) {
          browserCrashed = false; // Simulate browser restart
          throw new Error('Browser process crashed unexpectedly');
        }
        return 'browser restarted successfully';
      });

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'browser crash test'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('browser restarted successfully');
    });

    it('should handle memory limit exceeded', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Memory limit exceeded - cannot allocate more memory')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'memory limit test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.UNKNOWN_ERROR);
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry memory errors
    });

    it('should handle browser launch failures', async () => {
      let launchAttempts = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        launchAttempts++;
        if (launchAttempts <= 2) {
          throw new Error('Browser launch failed - Chromium not found');
        }
        return 'browser launched successfully';
      });

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'browser launch test'
      );

      expect(result.success).toBe(true);
      expect(launchAttempts).toBe(3);
    });
  });

  describe('Configuration Error Simulations', () => {
    it('should handle missing environment variables', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Missing required environment variable: BOXMAGIC_EMAIL')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'missing env var test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.CONFIG_ERROR);
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry config errors
    });

    it('should handle invalid configuration', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Invalid configuration: reservationTime must be in ISO format')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'invalid config test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.CONFIG_ERROR);
    });

    it('should handle timezone errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Invalid timezone: America/Invalid_Timezone')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'timezone error test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.CONFIG_ERROR);
    });
  });

  describe('External Service Error Simulations', () => {
    it('should handle webhook failures with retries', async () => {
      let webhookAttempts = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        webhookAttempts++;
        if (webhookAttempts <= 2) {
          throw new Error('Webhook delivery failed - HTTP 500 error');
        }
        return 'webhook delivered successfully';
      });

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'webhook failure test'
      );

      expect(result.success).toBe(true);
      expect(webhookAttempts).toBe(3);
    });

    it('should handle notification service failures', async () => {
      const mockOperation = vi.fn().mockRejectedValue(
        new Error('Notification service unavailable')
      );

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'notification failure test'
      );

      expect(result.success).toBe(false);
      expect(result.lastErrorType).toBe(ErrorType.UNKNOWN_ERROR);
    });
  });

  describe('Complex Error Scenarios', () => {
    it('should handle cascading failures', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        attemptCount++;
        switch (attemptCount) {
          case 1:
            throw new Error('Network connection failed');
          case 2:
            throw new Error('Element not found after network recovery');
          case 3:
            throw new Error('Session expired during operation');
          default:
            return 'success after multiple recoveries';
        }
      });

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'cascading failures test',
        { maxRetries: 5 }
      );

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(4);
    });

    it('should handle mixed error types with appropriate strategies', async () => {
      const errors = [
        'Network timeout occurred',
        'Element selector not found',
        'Browser process disconnected',
        'Invalid credentials provided'
      ];

      for (const errorMessage of errors) {
        const errorType = classifyError(errorMessage);
        const mockOperation = vi.fn().mockRejectedValue(new Error(errorMessage));

        const result = await retryManager.executeWithRetry(
          mockOperation,
          `mixed error test: ${errorMessage}`
        );

        expect(result.success).toBe(false);
        expect(result.lastErrorType).toBe(errorType);

        // Verify retry behavior matches error classification
        const classification = await import('../../src/types/ErrorTypes').then(
          m => m.getErrorClassification(errorType)
        );
        
        if (classification.retryStrategy === 'no_retry') {
          expect(mockOperation).toHaveBeenCalledTimes(1);
        } else {
          expect(mockOperation).toHaveBeenCalledTimes(
            Math.min(classification.maxRetries + 1, 4)
          );
        }
      }
    });

    it('should handle timeout during retry operations', async () => {
      const mockOperation = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), 2000);
        });
      });

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'timeout during retry test',
        { timeoutMs: 1000 }
      );

      expect(result.success).toBe(false);
    });

    it('should handle rapid successive errors', async () => {
      const errors = [
        'Network error 1',
        'Network error 2', 
        'Network error 3'
      ];
      
      let errorIndex = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        if (errorIndex < errors.length) {
          throw new Error(errors[errorIndex++]);
        }
        return 'success after rapid errors';
      });

      const result = await retryManager.executeWithRetry(
        mockOperation,
        'rapid successive errors test'
      );

      expect(result.success).toBe(true);
      expect(errorIndex).toBe(3);
    });
  });
});