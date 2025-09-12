import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  WebhookSender, 
  WebhookFormatter, 
  WebhookType, 
  getWebhookFormatter,
  type WebhookConfig,
  type WebhookDeliveryResult 
} from '../../src/utils/webhook';
import { WebhookPayload, LogLevel } from '../../src/core/Logger';
import { ReservationResult, TimingMetrics } from '../../src/types/ReservationTypes';

// Mock fetch for webhook tests
global.fetch = vi.fn();

describe('WebhookSender', () => {
  let webhookSender: WebhookSender;
  let mockPayload: WebhookPayload;

  beforeEach(() => {
    const config: WebhookConfig = {
      url: 'https://webhook.example.com/notify',
      timeout: 5000,
      retries: 2,
      retryDelay: 100
    };
    
    webhookSender = new WebhookSender(config);

    mockPayload = {
      timestamp: new Date().toISOString(),
      success: true,
      scheduleId: 'test-schedule',
      className: 'Test Class',
      logs: [{
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        message: 'Test log',
        component: 'Test'
      }],
      summary: {
        totalLogs: 1,
        errorCount: 0,
        warningCount: 0,
        phases: ['test'],
        duration: 100
      },
      metadata: {
        botVersion: '1.0.0',
        environment: 'test',
        timezone: 'America/Santiago'
      }
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK'
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('Successful Delivery', () => {
    it('should send webhook successfully on first attempt', async () => {
      const result = await webhookSender.send(mockPayload);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.attempts).toBe(1);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/notify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'CrossFit-Reservation-Bot/1.0',
            'X-Webhook-Attempt': '1'
          }),
          body: JSON.stringify(mockPayload)
        })
      );
    });

    it('should include custom headers in requests', async () => {
      const configWithHeaders: WebhookConfig = {
        url: 'https://webhook.example.com/notify',
        headers: {
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value'
        }
      };

      const senderWithHeaders = new WebhookSender(configWithHeaders);
      await senderWithHeaders.send(mockPayload);

      expect(fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/notify',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
            'X-Custom-Header': 'custom-value'
          })
        })
      );
    });
  });

  describe('Retry Logic', () => {
    it('should retry on server errors (5xx)', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK'
        } as Response);

      const result = await webhookSender.send(mockPayload);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors (4xx)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      } as Response);

      const result = await webhookSender.send(mockPayload);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.attempts).toBe(1);
      expect(result.error).toBe('HTTP 400: Bad Request');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK'
        } as Response);

      const result = await webhookSender.send(mockPayload);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should fail after all retries exhausted', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Persistent network error'));

      const result = await webhookSender.send(mockPayload);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2); // Default retries in config
      expect(result.error).toBe('Persistent network error');
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Timeout Handling', () => {
    it('should handle request timeout', async () => {
      // Mock AbortController to simulate timeout
      const mockAbortController = {
        signal: { aborted: false },
        abort: vi.fn()
      };
      
      global.AbortController = vi.fn(() => mockAbortController) as any;
      
      // Mock fetch to simulate timeout by rejecting with abort error
      vi.mocked(fetch).mockRejectedValue(new Error('The operation was aborted'));

      const result = await webhookSender.send(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
    }, 10000); // Increase timeout for this test
  });

  describe('Test Functionality', () => {
    it('should send test webhook notification', async () => {
      const result = await webhookSender.test();

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/notify',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"scheduleId":"webhook-test"')
        })
      );
    });

    it('should handle test webhook failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      const result = await webhookSender.test();

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
    });
  });

  describe('URL Validation', () => {
    it('should validate valid HTTPS URLs', async () => {
      const result = await WebhookSender.validate('https://valid.webhook.com/endpoint');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate valid HTTP URLs', async () => {
      const result = await WebhookSender.validate('http://valid.webhook.com/endpoint');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid protocols', async () => {
      const result = await WebhookSender.validate('ftp://invalid.protocol.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('HTTP or HTTPS protocol');
    });

    it('should reject malformed URLs', async () => {
      const result = await WebhookSender.validate('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should handle network errors during validation', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network unreachable'));

      const result = await WebhookSender.validate('https://unreachable.webhook.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Webhook validation failed');
    });
  });
});

describe('WebhookFormatter', () => {
  let mockPayload: WebhookPayload;

  beforeEach(() => {
    const mockResult: ReservationResult = {
      success: true,
      message: 'Reservation successful',
      timestamp: new Date(),
      timingAccuracy: 25,
      hasSpots: true,
      participantCount: '8/15',
      classStatus: 'already_booked'
    };

    const mockMetrics: TimingMetrics = {
      preparationDuration: 15000,
      executionDuration: 75,
      targetAccuracy: 25,
      totalDuration: 15075
    };

    mockPayload = {
      timestamp: '2024-01-15T17:00:00.000Z',
      success: true,
      scheduleId: 'crossfit-monday-18',
      className: '18:00 CrossFit',
      reservationResult: mockResult,
      timingMetrics: mockMetrics,
      logs: [{
        timestamp: '2024-01-15T17:00:00.000Z',
        level: LogLevel.INFO,
        message: 'Reservation completed',
        component: 'ReservationBot'
      }],
      summary: {
        totalLogs: 15,
        errorCount: 0,
        warningCount: 1,
        phases: ['preparation', 'execution', 'verification'],
        duration: 15075
      },
      metadata: {
        botVersion: '1.0.0',
        environment: 'production',
        timezone: 'America/Santiago'
      }
    };
  });

  describe('Slack Formatting', () => {
    it('should format successful reservation for Slack', () => {
      const formatted = WebhookFormatter.formatForSlack(mockPayload);

      expect(formatted).toMatchObject({
        attachments: [{
          color: 'good',
          title: expect.stringContaining(':white_check_mark:'),
          title: expect.stringContaining('Success'),
          fields: expect.arrayContaining([
            expect.objectContaining({
              title: 'Class',
              value: '18:00 CrossFit'
            }),
            expect.objectContaining({
              title: 'Timing Accuracy',
              value: '25ms'
            })
          ]),
          footer: 'CrossFit Reservation Bot'
        }]
      });
    });

    it('should format failed reservation for Slack', () => {
      const failedPayload = { ...mockPayload, success: false, error: 'No spots available' };
      const formatted = WebhookFormatter.formatForSlack(failedPayload);

      expect(formatted).toMatchObject({
        attachments: [{
          color: 'danger',
          title: expect.stringContaining(':x:'),
          title: expect.stringContaining('Failed')
        }]
      });
    });
  });

  describe('Discord Formatting', () => {
    it('should format successful reservation for Discord', () => {
      const formatted = WebhookFormatter.formatForDiscord(mockPayload);

      expect(formatted).toMatchObject({
        embeds: [{
          title: expect.stringContaining('Success'),
          color: 0x00ff00,
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: 'Class',
              value: '18:00 CrossFit'
            }),
            expect.objectContaining({
              name: 'Result',
              value: 'Reservation successful'
            })
          ]),
          timestamp: '2024-01-15T17:00:00.000Z',
          footer: {
            text: 'CrossFit Reservation Bot'
          }
        }]
      });
    });

    it('should format failed reservation for Discord', () => {
      const failedPayload = { ...mockPayload, success: false, error: 'Class full' };
      const formatted = WebhookFormatter.formatForDiscord(failedPayload);

      expect(formatted).toMatchObject({
        embeds: [{
          title: expect.stringContaining('Failed'),
          color: 0xff0000
        }]
      });
    });
  });

  describe('Teams Formatting', () => {
    it('should format successful reservation for Teams', () => {
      const formatted = WebhookFormatter.formatForTeams(mockPayload);

      expect(formatted).toMatchObject({
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: expect.stringContaining('Success'),
        themeColor: '00FF00',
        sections: [{
          activityTitle: expect.stringContaining('Success'),
          activitySubtitle: '18:00 CrossFit',
          facts: expect.arrayContaining([
            expect.objectContaining({
              name: 'Schedule ID',
              value: 'crossfit-monday-18'
            }),
            expect.objectContaining({
              name: 'Timing Accuracy',
              value: '25ms'
            })
          ])
        }]
      });
    });

    it('should format failed reservation for Teams', () => {
      const failedPayload = { ...mockPayload, success: false, error: 'Network timeout' };
      const formatted = WebhookFormatter.formatForTeams(failedPayload);

      expect(formatted).toMatchObject({
        themeColor: 'FF0000',
        sections: [{
          activityTitle: expect.stringContaining('Failed')
        }]
      });
    });
  });

  describe('Generic Formatting', () => {
    it('should return payload as-is for generic format', () => {
      const formatted = WebhookFormatter.formatGeneric(mockPayload);
      expect(formatted).toEqual(mockPayload);
    });
  });
});

describe('getWebhookFormatter', () => {
  let mockPayload: WebhookPayload;

  beforeEach(() => {
    mockPayload = {
      timestamp: new Date().toISOString(),
      success: true,
      scheduleId: 'test',
      className: 'Test Class',
      logs: [],
      summary: {
        totalLogs: 0,
        errorCount: 0,
        warningCount: 0,
        phases: [],
        duration: 0
      },
      metadata: {
        botVersion: '1.0.0',
        environment: 'test',
        timezone: 'America/Santiago'
      }
    };
  });

  it('should return Slack formatter for Slack type', () => {
    const formatter = getWebhookFormatter(WebhookType.SLACK);
    const result = formatter(mockPayload);
    
    expect(result).toHaveProperty('attachments');
  });

  it('should return Discord formatter for Discord type', () => {
    const formatter = getWebhookFormatter(WebhookType.DISCORD);
    const result = formatter(mockPayload);
    
    expect(result).toHaveProperty('embeds');
  });

  it('should return Teams formatter for Teams type', () => {
    const formatter = getWebhookFormatter(WebhookType.TEAMS);
    const result = formatter(mockPayload);
    
    expect(result).toHaveProperty('@type', 'MessageCard');
  });

  it('should return generic formatter for generic type', () => {
    const formatter = getWebhookFormatter(WebhookType.GENERIC);
    const result = formatter(mockPayload);
    
    expect(result).toEqual(mockPayload);
  });

  it('should return generic formatter for unknown type', () => {
    const formatter = getWebhookFormatter('unknown' as WebhookType);
    const result = formatter(mockPayload);
    
    expect(result).toEqual(mockPayload);
  });
});