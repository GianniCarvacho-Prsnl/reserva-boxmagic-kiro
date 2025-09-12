import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Logger, LogLevel, ReservationPhase } from '../../src/core/Logger';
import { ReservationResult, TimingMetrics } from '../../src/types/ReservationTypes';

// Mock fetch for webhook tests
global.fetch = vi.fn();

describe('Logger Integration Tests', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('https://webhook.example.com/notify', 'IntegrationTest');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('Complete Reservation Process Logging', () => {
    it('should log a complete reservation process with timing metrics', async () => {
      // Simulate a complete reservation process
      const scheduleConfig = {
        scheduleId: 'crossfit-monday-18',
        className: '18:00 CrossFit',
        targetTime: '2024-01-15T17:00:00-03:00'
      };

      // 1. Start reservation attempt
      logger.logReservationAttempt(scheduleConfig);

      // 2. Configuration phase
      logger.setPhase(ReservationPhase.CONFIGURATION);
      logger.logInfo('Configuration loaded', { 
        email: 'test@example.com',
        timezone: 'America/Santiago'
      });

      // 3. Preparation phase with timing
      const prepStartTime = logger.logTimingStart('preparation');
      logger.setPhase(ReservationPhase.PREPARATION);
      logger.logInfo('Browser initialized');
      
      // Simulate preparation time
      await new Promise(resolve => setTimeout(resolve, 50));
      logger.logTimingEnd('preparation', prepStartTime);

      // 4. Login phase
      logger.logLoginAttempt('test@example.com');
      logger.logLoginSuccess();

      // 5. Navigation phase
      logger.logNavigationStep('Navigate to schedule page', 'https://members.boxmagic.app/app/horarios');
      logger.logNavigationStep('Select day', 'tomorrow');

      // 6. Class selection
      logger.logClassSelection('18:00 CrossFit', 'tomorrow');
      logger.logClassStatus('18:00 CrossFit', 'available', '5/15');

      // 7. Critical timing execution
      const targetTime = new Date('2024-01-15T17:00:00.000Z');
      const actualTime = new Date('2024-01-15T17:00:00.025Z'); // 25ms later
      logger.logCriticalTiming('Button click', targetTime, actualTime);

      // 8. Execution steps
      const execStartTime = logger.logTimingStart('execution');
      logger.logExecutionStep('Click class heading', true, 15);
      logger.logExecutionStep('Click Agendar button', true, 10);
      
      await new Promise(resolve => setTimeout(resolve, 25));
      logger.logTimingEnd('execution', execStartTime, targetTime);

      // 9. Verification and result
      const reservationResult: ReservationResult = {
        success: true,
        message: 'Reservation successful',
        timestamp: new Date(),
        timingAccuracy: 25,
        hasSpots: true,
        participantCount: '6/15',
        classStatus: 'already_booked'
      };

      const timingMetrics: TimingMetrics = {
        preparationDuration: 50,
        executionDuration: 25,
        targetAccuracy: 25,
        totalDuration: 75
      };

      logger.logReservationResult(reservationResult, timingMetrics);

      // 10. Send webhook notification
      await logger.sendWebhookNotification(
        true,
        reservationResult,
        timingMetrics,
        scheduleConfig.scheduleId,
        scheduleConfig.className
      );

      // Verify the complete process was logged correctly
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(15); // Should have many log entries

      // Verify all phases were covered
      const report = logger.generateSummaryReport();
      expect(report.phases).toContain(ReservationPhase.INITIALIZATION);
      expect(report.phases).toContain(ReservationPhase.CONFIGURATION);
      expect(report.phases).toContain(ReservationPhase.PREPARATION);
      expect(report.phases).toContain(ReservationPhase.LOGIN);
      expect(report.phases).toContain(ReservationPhase.NAVIGATION);
      expect(report.phases).toContain(ReservationPhase.CLASS_SELECTION);
      expect(report.phases).toContain(ReservationPhase.CRITICAL_TIMING);
      expect(report.phases).toContain(ReservationPhase.EXECUTION);
      expect(report.phases).toContain(ReservationPhase.VERIFICATION);
      expect(report.phases).toContain(ReservationPhase.NOTIFICATION);

      // Verify timing metrics were captured (allow for small timing variations)
      expect(report.timingMetrics?.preparationDuration).toBeGreaterThanOrEqual(45);
      expect(report.timingMetrics?.executionDuration).toBeGreaterThanOrEqual(20);
      expect(report.timingMetrics?.targetAccuracy).toBe(25);

      // Verify webhook was called
      expect(fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/notify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );

      // Verify webhook payload structure
      const webhookCall = vi.mocked(fetch).mock.calls[0];
      const payload = JSON.parse(webhookCall[1]?.body as string);
      expect(payload).toMatchObject({
        success: true,
        scheduleId: 'crossfit-monday-18',
        className: '18:00 CrossFit',
        reservationResult: expect.objectContaining({
          success: true,
          classStatus: 'already_booked'
        }),
        timingMetrics: expect.objectContaining({
          preparationDuration: 50,
          executionDuration: 25
        })
      });
      expect(payload.logs).toBeInstanceOf(Array);
      expect(payload.logs.length).toBeGreaterThan(0);
    });

    it('should handle error scenarios with proper logging', async () => {
      const scheduleConfig = {
        scheduleId: 'crossfit-error-test',
        className: 'NonExistent Class',
        targetTime: '2024-01-15T17:00:00-03:00'
      };

      // Start process
      logger.logReservationAttempt(scheduleConfig);

      // Simulate login failure
      logger.logLoginAttempt('invalid@example.com');
      logger.logError('Login failed: Invalid credentials', {
        email: 'invalid@example.com',
        attemptNumber: 1
      });

      // Simulate class not found
      logger.setPhase(ReservationPhase.CLASS_SELECTION);
      logger.logWarn('Class not found', { 
        className: 'NonExistent Class',
        availableClasses: ['18:00 CrossFit', 'METCON', '19:00 CrossFit']
      });

      // Log final failure result
      const failureResult: ReservationResult = {
        success: false,
        message: 'Class not found',
        timestamp: new Date(),
        timingAccuracy: 0,
        hasSpots: false,
        classStatus: 'available'
      };

      logger.logReservationResult(failureResult);

      // Send failure notification
      await logger.sendWebhookNotification(
        false,
        failureResult,
        undefined,
        scheduleConfig.scheduleId,
        scheduleConfig.className,
        'Class not found'
      );

      // Verify error logging
      const report = logger.generateSummaryReport();
      expect(report.errorCount).toBe(1);
      expect(report.warningCount).toBe(1);

      const errorLogs = logger.getLogsByLevel(LogLevel.ERROR);
      expect(errorLogs[0].message).toContain('Login failed');

      const warningLogs = logger.getLogsByLevel(LogLevel.WARN);
      expect(warningLogs[0].message).toContain('Class not found');

      // Verify failure webhook
      const webhookCall = vi.mocked(fetch).mock.calls[0];
      const payload = JSON.parse(webhookCall[1]?.body as string);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Class not found');
    });

    it('should measure timing accuracy correctly in real scenarios', () => {
      // Test precise timing measurement
      const targetTime = new Date('2024-01-15T17:00:00.000Z');
      
      // Simulate different timing scenarios
      const scenarios = [
        { actual: new Date('2024-01-15T16:59:59.995Z'), expected: -5 }, // 5ms early
        { actual: new Date('2024-01-15T17:00:00.000Z'), expected: 0 },  // Perfect timing
        { actual: new Date('2024-01-15T17:00:00.050Z'), expected: 50 }, // 50ms late
        { actual: new Date('2024-01-15T17:00:00.150Z'), expected: 150 } // 150ms late
      ];

      scenarios.forEach((scenario, index) => {
        logger.logCriticalTiming(`Test scenario ${index + 1}`, targetTime, scenario.actual);
        
        const logs = logger.getLogs();
        const lastLog = logs[logs.length - 1];
        
        expect(lastLog.timingMetrics?.targetAccuracy).toBe(scenario.expected);
        expect(lastLog.metadata?.accuracy).toBe(`${scenario.expected}ms`);
        expect(lastLog.metadata?.withinTolerance).toBe(Math.abs(scenario.expected) <= 100);
      });

      // Verify all timing logs were captured
      const criticalTimingLogs = logger.getLogsByPhase(ReservationPhase.CRITICAL_TIMING);
      expect(criticalTimingLogs.length).toBe(scenarios.length * 2); // Each scenario creates 2 logs (setPhase + timing)
    });

    it('should handle high-frequency logging without performance issues', () => {
      // Temporarily suppress console output for this test
      const originalConsoleDebug = console.debug;
      console.debug = vi.fn();
      
      const startTime = Date.now();
      
      // Generate many log entries quickly
      for (let i = 0; i < 1000; i++) {
        logger.logDebug(`High frequency log ${i}`, { iteration: i });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Restore console
      console.debug = originalConsoleDebug;
      
      // Should complete quickly (less than 1 second for 1000 logs)
      expect(duration).toBeLessThan(1000);
      
      // Verify all logs were captured
      const logs = logger.getLogs();
      expect(logs.length).toBe(1000);
      
      // Verify log structure is maintained
      expect(logs[0]).toMatchObject({
        level: LogLevel.DEBUG,
        message: 'High frequency log 0',
        metadata: { iteration: 0 }
      });
      
      expect(logs[999]).toMatchObject({
        level: LogLevel.DEBUG,
        message: 'High frequency log 999',
        metadata: { iteration: 999 }
      });
    });
  });

  describe('Memory Management', () => {
    it('should handle log clearing for memory management', () => {
      // Generate many logs
      for (let i = 0; i < 100; i++) {
        logger.logInfo(`Log entry ${i}`);
      }
      
      expect(logger.getLogs().length).toBe(100);
      
      // Clear logs
      logger.clearLogs();
      
      // Should only have the "Logs cleared" debug message
      expect(logger.getLogs().length).toBe(1);
      expect(logger.getLogs()[0].message).toContain('Logs cleared');
    });

    it('should limit webhook payload size', async () => {
      // Generate more than 20 logs
      for (let i = 0; i < 30; i++) {
        logger.logInfo(`Log entry ${i}`);
      }
      
      await logger.sendWebhookNotification(true);
      
      const webhookCall = vi.mocked(fetch).mock.calls[0];
      const payload = JSON.parse(webhookCall[1]?.body as string);
      
      // Should only include last 20 logs (accounting for webhook notification logs)
      expect(payload.logs.length).toBe(20);
      // The logs should include recent entries and webhook notification logs
      const hasRecentLogs = payload.logs.some(log => log.message.includes('Log entry'));
      const hasWebhookLogs = payload.logs.some(log => log.message.includes('notification'));
      expect(hasRecentLogs).toBe(true);
      expect(hasWebhookLogs).toBe(true);
    });
  });

  describe('Webhook Reliability and Error Handling', () => {
    it('should handle webhook service outages gracefully', async () => {
      // Mock complete service outage
      vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));

      const result: ReservationResult = {
        success: true,
        message: 'Reservation successful',
        timestamp: new Date(),
        timingAccuracy: 25,
        hasSpots: true,
        classStatus: 'already_booked'
      };

      // This should not throw an error
      await expect(logger.sendWebhookNotification(true, result)).resolves.toBeUndefined();

      // Should log the error but continue
      const errorLogs = logger.getLogsByLevel(LogLevel.ERROR);
      expect(errorLogs.some(log => log.message.includes('failed after all retries'))).toBe(true);
    });

    it('should handle malformed webhook responses', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.reject(new Error('Cannot read response'))
      } as Response);

      await logger.sendWebhookNotification(false, undefined, undefined, undefined, undefined, 'Test error');

      expect(fetch).toHaveBeenCalled();
      const logs = logger.getLogs();
      const warningLog = logs.find(log => log.message.includes('Webhook notification failed'));
      expect(warningLog).toBeDefined();
    });

    it('should validate webhook configuration before sending', async () => {
      const testLogger = new Logger('https://nonexistent.webhook.service.com/endpoint');
      
      // Mock fetch to simulate network error for validation
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      
      // This should handle the validation gracefully
      const validationResult = await testLogger.validateWebhookUrl('https://nonexistent.webhook.service.com/endpoint');
      
      // Should fail due to network error
      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toContain('Webhook URL validation failed');
    });

    it('should send comprehensive webhook payload for complex scenarios', async () => {
      // Simulate a complex reservation scenario with multiple phases and timing
      logger.logReservationAttempt({ scheduleId: 'complex-test', className: 'Advanced CrossFit', targetTime: '2024-01-15T17:00:00Z' });
      
      // Add logs from multiple phases
      logger.setPhase(ReservationPhase.PREPARATION);
      logger.logInfo('Preparation started');
      logger.logWarn('Slow network detected');
      
      logger.setPhase(ReservationPhase.LOGIN);
      logger.logLoginAttempt('user@example.com');
      logger.logLoginSuccess();
      
      logger.setPhase(ReservationPhase.CRITICAL_TIMING);
      const targetTime = new Date();
      const actualTime = new Date(targetTime.getTime() + 75);
      logger.logCriticalTiming('Reservation execution', targetTime, actualTime);
      
      logger.setPhase(ReservationPhase.EXECUTION);
      logger.logExecutionStep('Click class', true, 25);
      logger.logExecutionStep('Click reserve', true, 50);
      
      const complexResult: ReservationResult = {
        success: true,
        message: 'Complex reservation completed',
        timestamp: new Date(),
        timingAccuracy: 75,
        hasSpots: true,
        participantCount: '12/15',
        classStatus: 'already_booked'
      };

      const complexMetrics: TimingMetrics = {
        preparationDuration: 15000,
        executionDuration: 75,
        targetAccuracy: 75,
        totalDuration: 15075
      };

      await logger.sendWebhookNotification(true, complexResult, complexMetrics, 'complex-test', 'Advanced CrossFit');

      const webhookCall = vi.mocked(fetch).mock.calls[0];
      const payload = JSON.parse(webhookCall[1]?.body as string);

      // Verify comprehensive payload structure
      expect(payload).toMatchObject({
        success: true,
        scheduleId: 'complex-test',
        className: 'Advanced CrossFit',
        reservationResult: expect.objectContaining({
          success: true,
          timingAccuracy: 75,
          participantCount: '12/15'
        }),
        timingMetrics: expect.objectContaining({
          preparationDuration: 15000,
          executionDuration: 75,
          targetAccuracy: 75
        }),
        summary: expect.objectContaining({
          totalLogs: expect.any(Number),
          errorCount: 0,
          warningCount: 1, // The "Slow network detected" warning
          phases: expect.arrayContaining([
            ReservationPhase.PREPARATION,
            ReservationPhase.LOGIN,
            ReservationPhase.CRITICAL_TIMING,
            ReservationPhase.EXECUTION,
            ReservationPhase.NOTIFICATION
          ])
        }),
        metadata: expect.objectContaining({
          botVersion: '1.0.0',
          environment: expect.any(String),
          timezone: expect.any(String)
        })
      });

      expect(payload.logs).toBeInstanceOf(Array);
      expect(payload.logs.length).toBeGreaterThan(0);
      expect(payload.logs.length).toBeLessThanOrEqual(20);
    });

    it('should handle webhook test notifications correctly', async () => {
      const testResult = await logger.sendTestWebhookNotification();
      
      expect(testResult).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/notify',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Test': 'true'
          })
        })
      );

      const logs = logger.getLogs();
      const testLog = logs.find(log => log.message.includes('Sending test webhook'));
      expect(testLog).toBeDefined();
    });
  });
});