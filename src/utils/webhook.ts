// Webhook utility functions for CrossFit reservation bot

import { WebhookPayload } from '../core/Logger';

/**
 * Webhook configuration interface
 */
export interface WebhookConfig {
  url: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  attempts: number;
  error?: string;
}

/**
 * Enhanced webhook sender with configurable options
 */
export class WebhookSender {
  private config: Required<WebhookConfig>;

  constructor(config: WebhookConfig) {
    this.config = {
      url: config.url,
      timeout: config.timeout || 10000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CrossFit-Reservation-Bot/1.0',
        ...config.headers
      }
    };
  }

  /**
   * Send webhook notification with retry logic
   */
  async send(payload: WebhookPayload): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    let lastError: string | undefined;
    
    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: {
            ...this.config.headers,
            'X-Webhook-Attempt': attempt.toString(),
            'X-Webhook-Timestamp': payload.timestamp
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        if (response.ok) {
          return {
            success: true,
            statusCode: response.status,
            responseTime,
            attempts: attempt
          };
        } else {
          lastError = `HTTP ${response.status}: ${response.statusText}`;
          
          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            return {
              success: false,
              statusCode: response.status,
              responseTime,
              attempts: attempt,
              error: lastError
            };
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      // Wait before retry (except on last attempt)
      if (attempt < this.config.retries) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }

    return {
      success: false,
      responseTime: Date.now() - startTime,
      attempts: this.config.retries,
      error: lastError
    };
  }

  /**
   * Test webhook connectivity
   */
  async test(): Promise<WebhookDeliveryResult> {
    const testPayload: WebhookPayload = {
      timestamp: new Date().toISOString(),
      success: true,
      scheduleId: 'webhook-test',
      className: 'Test Notification',
      logs: [{
        timestamp: new Date().toISOString(),
        level: 'INFO' as any,
        message: 'Webhook connectivity test',
        component: 'WebhookSender'
      }],
      summary: {
        totalLogs: 1,
        errorCount: 0,
        warningCount: 0,
        phases: ['notification'],
        duration: 0
      },
      metadata: {
        botVersion: '1.0.0',
        environment: 'test',
        timezone: 'America/Santiago'
      }
    };

    return this.send(testPayload);
  }

  /**
   * Validate webhook URL and configuration
   */
  static async validate(url: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const urlObj = new URL(url);
      
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { 
          valid: false, 
          error: 'Webhook URL must use HTTP or HTTPS protocol' 
        };
      }

      // Test basic connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'CrossFit-Reservation-Bot/1.0'
        }
      });

      clearTimeout(timeoutId);
      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { 
        valid: false, 
        error: `Webhook validation failed: ${errorMessage}` 
      };
    }
  }
}

/**
 * Webhook payload formatter utilities
 */
export class WebhookFormatter {
  /**
   * Format payload for Slack webhook
   */
  static formatForSlack(payload: WebhookPayload): object {
    const color = payload.success ? 'good' : 'danger';
    const emoji = payload.success ? ':white_check_mark:' : ':x:';
    
    return {
      attachments: [{
        color,
        title: `${emoji} CrossFit Reservation ${payload.success ? 'Success' : 'Failed'}`,
        fields: [
          {
            title: 'Class',
            value: payload.className || 'Unknown',
            short: true
          },
          {
            title: 'Schedule ID',
            value: payload.scheduleId || 'Unknown',
            short: true
          },
          {
            title: 'Timing Accuracy',
            value: payload.timingMetrics?.targetAccuracy ? 
              `${payload.timingMetrics.targetAccuracy}ms` : 'N/A',
            short: true
          },
          {
            title: 'Total Duration',
            value: payload.summary.duration ? 
              `${payload.summary.duration}ms` : 'N/A',
            short: true
          }
        ],
        footer: 'CrossFit Reservation Bot',
        ts: Math.floor(new Date(payload.timestamp).getTime() / 1000)
      }]
    };
  }

  /**
   * Format payload for Discord webhook
   */
  static formatForDiscord(payload: WebhookPayload): object {
    const color = payload.success ? 0x00ff00 : 0xff0000;
    const title = `CrossFit Reservation ${payload.success ? 'Success' : 'Failed'}`;
    
    return {
      embeds: [{
        title,
        color,
        fields: [
          {
            name: 'Class',
            value: payload.className || 'Unknown',
            inline: true
          },
          {
            name: 'Schedule ID',
            value: payload.scheduleId || 'Unknown',
            inline: true
          },
          {
            name: 'Result',
            value: payload.reservationResult?.message || payload.error || 'No details',
            inline: false
          }
        ],
        timestamp: payload.timestamp,
        footer: {
          text: 'CrossFit Reservation Bot'
        }
      }]
    };
  }

  /**
   * Format payload for Microsoft Teams webhook
   */
  static formatForTeams(payload: WebhookPayload): object {
    const themeColor = payload.success ? '00FF00' : 'FF0000';
    const title = `CrossFit Reservation ${payload.success ? 'Success' : 'Failed'}`;
    
    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: title,
      themeColor,
      sections: [{
        activityTitle: title,
        activitySubtitle: payload.className || 'Unknown Class',
        facts: [
          {
            name: 'Schedule ID',
            value: payload.scheduleId || 'Unknown'
          },
          {
            name: 'Timing Accuracy',
            value: payload.timingMetrics?.targetAccuracy ? 
              `${payload.timingMetrics.targetAccuracy}ms` : 'N/A'
          },
          {
            name: 'Status',
            value: payload.reservationResult?.message || payload.error || 'No details'
          }
        ]
      }]
    };
  }

  /**
   * Format payload for generic webhook (default format)
   */
  static formatGeneric(payload: WebhookPayload): WebhookPayload {
    return payload; // Return as-is for generic webhooks
  }
}

/**
 * Webhook notification types
 */
export enum WebhookType {
  GENERIC = 'generic',
  SLACK = 'slack',
  DISCORD = 'discord',
  TEAMS = 'teams'
}

/**
 * Get appropriate formatter for webhook type
 */
export function getWebhookFormatter(type: WebhookType): (payload: WebhookPayload) => object {
  switch (type) {
    case WebhookType.SLACK:
      return WebhookFormatter.formatForSlack;
    case WebhookType.DISCORD:
      return WebhookFormatter.formatForDiscord;
    case WebhookType.TEAMS:
      return WebhookFormatter.formatForTeams;
    case WebhookType.GENERIC:
    default:
      return WebhookFormatter.formatGeneric;
  }
}