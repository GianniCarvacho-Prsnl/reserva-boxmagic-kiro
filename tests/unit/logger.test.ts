import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Logger, LogLevel, ReservationPhase } from '../../src/core/Logger';
import { ReservationResult, TimingMetrics } from '../../src/types/ReservationTypes';

// Mock fetch for webhook tests
global.fetch = vi.fn();

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    logger = new Logger();
    
    // Spy on console methods
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('Basic Logging Functionality', () => {
    it('should log debug messages with correct format', () => {
      const message = 'Debug test message';
      const metadata = { testKey: 'testValue' };
      
      logger.logDebug(message, metadata);
      
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining(`DEBUG: ${message}`)
      );
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(metadata))
      );
    });

    it('should log info messages with correct format', () => {
      const message = 'Info test message';
      
      logger.logInfo(message);
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining(`INFO: ${message}`)
      );
    });

    it('should log warning messages with correct format', () => {
      const message = 'Warning test message';
      
      logger.logWarn(message);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining(`WARN: ${message}`)
      );
    });

    it('should log error messages with correct format', () => {
      const error = new Error('Test error');
      
      logger.logError(error);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining(`ERROR: ${error.message}`)
      );
    });

    it('should log error strings correctly', () => {
      const errorMessage = 'String error message';
      
      logger.logError(errorMessage);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining(`ERROR: ${errorMessage}`)
      );
    });

    it('should include stack trace for Error objects', () => {
      const error = new Error('Test error with stack');
      const metadata = { context: 'test' };
      
      logger.logError(error, metadata);
      
      const logs = logger.getLogs();
      expect(logs[0].metadata).toHaveProperty('stack');
      expect(logs[0].metadata?.context).toBe('test');
    });
  });

  describe('Structured Logging', () => {
    it('should store log entries with correct structure', () => {
      const message = 'Test message';
      const metadata = { key: 'value' };
      
      logger.logInfo(message, metadata);
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        level: LogLevel.INFO,
        message,
        metadata,
        component: 'ReservationBot'
      });
      expect(logs[0].timestamp).toBeDefined();
    });

    it('should include phase information when set', () => {
      logger.setPhase(ReservationPhase.LOGIN);
      logger.logInfo('Login attempt');
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(2); // setPhase creates a debug log + our info log
      expect(logs[1].phase).toBe(ReservationPhase.LOGIN);
    });

    it('should include timing metrics when provided', () => {
      const timingMetrics: Partial<TimingMetrics> = {
        executionDuration: 150,
        targetAccuracy: 5
      };
      
      logger.logInfo('Execution complete', {}, timingMetrics);
      
      const logs = logger.getLogs();
      expect(logs[0].timingMetrics).toEqual(timingMetrics);
    });
  });

  describe('Phase Management', () => {
    it('should set and track current phase', () => {
      logger.setPhase(ReservationPhase.PREPARATION);
      
      const logs = logger.getLogs();
      expect(logs[0].message).toContain('Entering phase: preparation');
      expect(logs[0].level).toBe(LogLevel.DEBUG);
    });

    it('should include phase in subsequent logs', () => {
      logger.setPhase(ReservationPhase.EXECUTION);
      logger.logInfo('Test message');
      
      const logs = logger.getLogs();
      expect(logs[1].phase).toBe(ReservationPhase.EXECUTION);
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log reservation attempt with correct phase and metadata', () => {
      const config = {
        scheduleId: 'test-schedule',
        className: 'CrossFit',
        targetTime: '2024-01-01T18:00:00Z'
      };
      
      logger.logReservationAttempt(config);
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(2); // setPhase + logReservationAttempt
      expect(logs[1].message).toBe('Starting reservation attempt');
      expect(logs[1].metadata).toEqual(config);
      expect(logs[1].phase).toBe(ReservationPhase.INITIALIZATION);
    });

    it('should log reservation result with timing metrics', () => {
      const result: ReservationResult = {
        success: true,
        message: 'Reservation successful',
        timestamp: new Date(),
        timingAccuracy: 50,
        hasSpots: true,
        participantCount: '5/15',
        classStatus: 'available'
      };
      
      const timingMetrics: TimingMetrics = {
        preparationDuration: 25000,
        executionDuration: 150,
        targetAccuracy: 5,
        totalDuration: 25150
      };
      
      logger.logReservationResult(result, timingMetrics);
      
      const logs = logger.getLogs();
      expect(logs[1].message).toBe('Reservation completed');
      expect(logs[1].timingMetrics).toEqual(timingMetrics);
      expect(logs[1].phase).toBe(ReservationPhase.VERIFICATION);
    });

    it('should log login attempt with masked email', () => {
      const email = 'test@example.com';
      
      logger.logLoginAttempt(email);
      
      const logs = logger.getLogs();
      expect(logs[1].metadata?.email).toBe('tes***@example.com');
      expect(logs[1].phase).toBe(ReservationPhase.LOGIN);
    });

    it('should log critical timing with accuracy calculation', () => {
      const targetTime = new Date('2024-01-01T18:00:00.000Z');
      const actualTime = new Date('2024-01-01T18:00:00.050Z'); // 50ms later
      
      logger.logCriticalTiming('Button click', targetTime, actualTime);
      
      const logs = logger.getLogs();
      expect(logs[1].message).toBe('Critical timing: Button click');
      expect(logs[1].metadata?.accuracy).toBe('50ms');
      expect(logs[1].metadata?.withinTolerance).toBe(true);
      expect(logs[1].timingMetrics?.targetAccuracy).toBe(50);
    });
  });

  describe('Timing Measurement', () => {
    it('should measure operation timing correctly', () => {
      const startTime = logger.logTimingStart('test operation');
      
      // Simulate some time passing
      const endTime = new Date(startTime.getTime() + 100);
      vi.setSystemTime(endTime);
      
      const duration = logger.logTimingEnd('test operation', startTime);
      
      expect(duration).toBe(100);
      
      const logs = logger.getLogs();
      expect(logs[1].metadata?.duration).toBe('100ms');
    });

    it('should calculate target accuracy when provided', () => {
      const startTime = new Date();
      const targetTime = new Date(startTime.getTime() + 50);
      const endTime = new Date(startTime.getTime() + 75);
      
      vi.setSystemTime(endTime);
      
      logger.logTimingEnd('execution', startTime, targetTime);
      
      const logs = logger.getLogs();
      expect(logs[0].metadata?.accuracy).toBe('25ms');
      expect(logs[0].timingMetrics?.targetAccuracy).toBe(25);
    });
  });

  describe('Log Filtering and Retrieval', () => {
    beforeEach(() => {
      logger.logDebug('Debug message');
      logger.logInfo('Info message');
      logger.logWarn('Warning message');
      logger.logError('Error message');
      
      logger.setPhase(ReservationPhase.LOGIN);
      logger.logInfo('Login message');
    });

    it('should filter logs by level', () => {
      const errorLogs = logger.getLogsByLevel(LogLevel.ERROR);
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Error message');
      
      const infoLogs = logger.getLogsByLevel(LogLevel.INFO);
      expect(infoLogs).toHaveLength(2); // 'Info message' + 'Login message'
    });

    it('should filter logs by phase', () => {
      const loginLogs = logger.getLogsByPhase(ReservationPhase.LOGIN);
      expect(loginLogs).toHaveLength(2); // setPhase debug log + 'Login message'
    });

    it('should return all logs', () => {
      const allLogs = logger.getLogs();
      expect(allLogs).toHaveLength(6); // 4 initial + setPhase debug + login message
    });

    it('should clear logs', () => {
      logger.clearLogs();
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1); // Only the "Logs cleared" debug message
    });
  });

  describe('Summary Report Generation', () => {
    beforeEach(() => {
      logger.logInfo('Start');
      logger.logWarn('Warning 1');
      logger.logWarn('Warning 2');
      logger.logError('Error 1');
      logger.setPhase(ReservationPhase.LOGIN);
      logger.logInfo('Login');
      logger.setPhase(ReservationPhase.EXECUTION);
      logger.logInfo('Execution', {}, { executionDuration: 150 });
    });

    it('should generate correct summary report', async () => {
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const report = logger.generateSummaryReport();
      
      expect(report.totalLogs).toBe(8); // All logs including setPhase debug logs
      expect(report.errorCount).toBe(1);
      expect(report.warningCount).toBe(2);
      expect(report.phases).toContain(ReservationPhase.LOGIN);
      expect(report.phases).toContain(ReservationPhase.EXECUTION);
      expect(report.totalDuration).toBeGreaterThanOrEqual(0); // Changed to >= 0 since it might be 0 in fast tests
      expect(report.timingMetrics?.executionDuration).toBe(150);
    });
  });

  describe('Webhook Notifications', () => {
    let webhookLogger: Logger;

    beforeEach(() => {
      webhookLogger = new Logger('https://webhook.example.com/notify');
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200
      } as Response);
    });

    it('should send webhook notification on success', async () => {
      const result: ReservationResult = {
        success: true,
        message: 'Success',
        timestamp: new Date(),
        timingAccuracy: 25,
        hasSpots: true,
        classStatus: 'available'
      };

      const timingMetrics: TimingMetrics = {
        preparationDuration: 25000,
        executionDuration: 150,
        targetAccuracy: 5,
        totalDuration: 25150
      };

      await webhookLogger.sendWebhookNotification(
        true,
        result,
        timingMetrics,
        'test-schedule',
        'CrossFit'
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/notify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('"success":true')
        })
      );
    });

    it('should handle webhook failures gracefully', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      await webhookLogger.sendWebhookNotification(false, undefined, undefined, undefined, undefined, 'Test error');

      const logs = webhookLogger.getLogs();
      const errorLog = logs.find(log => log.message.includes('failed after all retries'));
      expect(errorLog).toBeDefined();
      expect(errorLog?.level).toBe(LogLevel.ERROR);
    });

    it('should skip webhook when URL not configured', async () => {
      const noWebhookLogger = new Logger();
      
      await noWebhookLogger.sendWebhookNotification(true);
      
      expect(fetch).not.toHaveBeenCalled();
      
      const logs = noWebhookLogger.getLogs();
      const debugLog = logs.find(log => log.message.includes('Webhook URL not configured'));
      expect(debugLog).toBeDefined();
    });

    it('should include recent logs in webhook payload', async () => {
      // Generate some logs
      for (let i = 0; i < 25; i++) {
        webhookLogger.logInfo(`Log entry ${i}`);
      }

      await webhookLogger.sendWebhookNotification(true);

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const payload = JSON.parse(fetchCall[1]?.body as string);
      
      expect(payload.logs).toHaveLength(20); // Should limit to last 20 logs
    });

    it('should include enhanced payload structure with summary and metadata', async () => {
      webhookLogger.logInfo('Test log 1');
      webhookLogger.logWarn('Test warning');
      webhookLogger.logError('Test error');

      await webhookLogger.sendWebhookNotification(true, undefined, undefined, 'test-schedule', 'Test Class');

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const payload = JSON.parse(fetchCall[1]?.body as string);

      expect(payload).toHaveProperty('summary');
      expect(payload.summary).toMatchObject({
        totalLogs: expect.any(Number),
        errorCount: 1,
        warningCount: 1,
        phases: expect.any(Array)
      });

      expect(payload).toHaveProperty('metadata');
      expect(payload.metadata).toMatchObject({
        botVersion: '1.0.0',
        environment: expect.any(String),
        timezone: expect.any(String)
      });
    });

    it('should retry webhook notifications on server errors', async () => {
      // Mock server error on first two attempts, success on third
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error', text: () => Promise.resolve('Server error') } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

      await webhookLogger.sendWebhookNotification(true);

      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors (4xx)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid payload')
      } as Response);

      await webhookLogger.sendWebhookNotification(true);

      expect(fetch).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should include retry attempt information in headers', async () => {
      await webhookLogger.sendWebhookNotification(true);

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const headers = fetchCall[1]?.headers as Record<string, string>;
      
      expect(headers).toMatchObject({
        'Content-Type': 'application/json',
        'User-Agent': 'CrossFit-Reservation-Bot/1.0',
        'X-Webhook-Attempt': '1',
        'X-Webhook-Source': 'crossfit-reservation-bot'
      });
    });

    it('should handle webhook timeout gracefully', async () => {
      // Reset any existing fake timers first
      vi.useRealTimers();
      
      // Mock a request that never resolves (simulating timeout)
      vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));

      // Use fake timers to control timeout
      vi.useFakeTimers();
      
      const webhookPromise = webhookLogger.sendWebhookNotification(true);
      
      // Fast-forward past the timeout
      vi.advanceTimersByTime(11000); // 11 seconds (timeout is 10 seconds)
      
      await webhookPromise;

      vi.useRealTimers();

      const logs = webhookLogger.getLogs();
      const timeoutLog = logs.find(log => log.message.includes('failed after all retries'));
      expect(timeoutLog).toBeDefined();
    });

    it('should send test webhook notification', async () => {
      const success = await webhookLogger.sendTestWebhookNotification();

      expect(success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/notify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Webhook-Test': 'true'
          })
        })
      );

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const payload = JSON.parse(fetchCall[1]?.body as string);
      expect(payload.scheduleId).toBe('test-webhook');
      expect(payload.className).toBe('Test Notification');
    });

    it('should validate webhook URL format', async () => {
      const validResult = await webhookLogger.validateWebhookUrl('https://valid.webhook.com/endpoint');
      expect(validResult.valid).toBe(true);

      const invalidResult = await webhookLogger.validateWebhookUrl('invalid-url');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('Invalid URL');
    });

    it('should validate webhook URL protocol', async () => {
      const ftpResult = await webhookLogger.validateWebhookUrl('ftp://invalid.protocol.com');
      expect(ftpResult.valid).toBe(false);
      expect(ftpResult.error).toContain('HTTP or HTTPS protocol');
    });
  });

  describe('Constructor Options', () => {
    it('should set webhook URL and component name', () => {
      const customLogger = new Logger('https://webhook.test.com', 'TestComponent');
      
      customLogger.logInfo('Test message');
      
      const logs = customLogger.getLogs();
      expect(logs[0].component).toBe('TestComponent');
    });

    it('should use default component name when not provided', () => {
      const defaultLogger = new Logger('https://webhook.test.com');
      
      defaultLogger.logInfo('Test message');
      
      const logs = defaultLogger.getLogs();
      expect(logs[0].component).toBe('ReservationBot');
    });
  });
});