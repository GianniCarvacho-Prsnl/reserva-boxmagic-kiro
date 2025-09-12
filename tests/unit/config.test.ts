import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../src/config/ConfigManager.js';
import type { ReservationConfig, ReservationSchedule } from '../../src/config/types.js';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const testConfigPath = join(process.cwd(), 'test-config.json');
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    
    // Set required environment variables
    process.env.BOXMAGIC_EMAIL = 'test@example.com';
    process.env.BOXMAGIC_PASSWORD = 'testpassword';
    
    // Reset the singleton instance for testing
    (ConfigManager as any).instance = undefined;
    configManager = ConfigManager.getInstance();
  });

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clean up test files
    if (existsSync(testConfigPath)) {
      await unlink(testConfigPath);
    }
    
    // Reset the singleton instance
    (ConfigManager as any).instance = undefined;
  });

  describe('Environment Variable Loading', () => {
    it('should load basic configuration from environment variables', async () => {
      process.env.BOXMAGIC_EMAIL = 'user@example.com';
      process.env.BOXMAGIC_PASSWORD = 'password123';
      process.env.TIMEZONE = 'America/New_York';
      process.env.BROWSER_HEADLESS = 'false';
      process.env.BROWSER_TIMEOUT = '45000';
      process.env.NOTIFICATIONS_ENABLED = 'true';
      process.env.WEBHOOK_URL = 'https://hooks.zapier.com/test';

      // Create empty schedules file
      await writeFile(testConfigPath, JSON.stringify({ schedules: [] }));

      const config = await configManager.loadConfig(testConfigPath, true);

      expect(config.credentials.email).toBe('user@example.com');
      expect(config.credentials.password).toBe('password123');
      expect(config.timezone).toBe('America/New_York');
      expect(config.browser.headless).toBe(false);
      expect(config.browser.timeout).toBe(45000);
      expect(config.notifications.enabled).toBe(true);
      expect(config.notifications.webhookUrl).toBe('https://hooks.zapier.com/test');
    });

    it('should use default values when optional environment variables are not set', async () => {
      // Create empty schedules file
      await writeFile(testConfigPath, JSON.stringify({ schedules: [] }));

      const config = await configManager.loadConfig(testConfigPath, true);

      expect(config.timezone).toBe('America/Santiago');
      expect(config.browser.headless).toBe(true);
      expect(config.browser.timeout).toBe(30000);
      expect(config.notifications.enabled).toBe(false);
      expect(config.notifications.webhookUrl).toBeUndefined();
    });

    it('should throw error when required environment variables are missing', async () => {
      delete process.env.BOXMAGIC_EMAIL;
      delete process.env.BOXMAGIC_PASSWORD;

      await expect(configManager.loadConfig()).rejects.toThrow(
        'Missing required environment variables: BOXMAGIC_EMAIL and BOXMAGIC_PASSWORD must be set'
      );
    });
  });

  describe('Configuration File Loading', () => {
    it('should load schedules from configuration file', async () => {
      const testSchedules: ReservationSchedule[] = [
        {
          id: 'test-schedule-1',
          dayToSelect: 'tomorrow',
          className: 'Test Class',
          reservationTime: '2024-12-09T17:00:00-03:00',
          bufferSeconds: 30,
          enabled: true,
          description: 'Test schedule'
        },
        {
          id: 'test-schedule-2',
          dayToSelect: 'today',
          className: 'Another Class',
          reservationTime: '2024-12-09T18:00:00-03:00',
          bufferSeconds: 45,
          enabled: false,
          cronExpression: '0 18 * * *'
        }
      ];

      await writeFile(testConfigPath, JSON.stringify({ schedules: testSchedules }));

      const config = await configManager.loadConfig(testConfigPath);

      expect(config.schedules).toHaveLength(2);
      expect(config.schedules[0]).toEqual(testSchedules[0]);
      expect(config.schedules[1]).toEqual(testSchedules[1]);
    });

    it('should handle missing configuration file gracefully', async () => {
      const config = await configManager.loadConfig('nonexistent-config.json', true);
      expect(config.schedules).toEqual([]);
    });

    it('should throw error for invalid JSON in configuration file', async () => {
      await writeFile(testConfigPath, '{ invalid json }');

      await expect(configManager.loadConfig(testConfigPath)).rejects.toThrow(
        /Invalid JSON in configuration file/
      );
    });

    it('should throw error when configuration file lacks schedules array', async () => {
      await writeFile(testConfigPath, JSON.stringify({ notSchedules: [] }));

      await expect(configManager.loadConfig(testConfigPath)).rejects.toThrow(
        'Configuration file must contain a "schedules" array'
      );
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration successfully', async () => {
      const validSchedule: ReservationSchedule = {
        id: 'valid-schedule',
        dayToSelect: 'tomorrow',
        className: 'Valid Class',
        reservationTime: '2024-12-09T17:00:00-03:00',
        bufferSeconds: 30,
        enabled: true
      };

      await writeFile(testConfigPath, JSON.stringify({ schedules: [validSchedule] }));

      const config = await configManager.loadConfig(testConfigPath);
      const validation = configManager.validateConfig(config);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid email format', async () => {
      process.env.BOXMAGIC_EMAIL = 'invalid-email';

      await writeFile(testConfigPath, JSON.stringify({ schedules: [] }));

      await expect(configManager.loadConfig(testConfigPath, true)).rejects.toThrow(
        /Invalid email format/
      );
    });

    it('should detect missing required fields', async () => {
      const invalidSchedule = {
        id: '',
        dayToSelect: 'invalid',
        className: '',
        reservationTime: 'invalid-date',
        bufferSeconds: 1000,
        enabled: true
      };

      await writeFile(testConfigPath, JSON.stringify({ schedules: [invalidSchedule] }));

      await expect(configManager.loadConfig(testConfigPath)).rejects.toThrow(
        /Configuration validation failed/
      );
    });

    it('should validate timezone format', async () => {
      process.env.TIMEZONE = 'Invalid/Timezone';

      await writeFile(testConfigPath, JSON.stringify({ schedules: [] }));

      await expect(configManager.loadConfig(testConfigPath, true)).rejects.toThrow(
        /Invalid timezone format/
      );
    });

    it('should validate browser timeout range', async () => {
      process.env.BROWSER_TIMEOUT = '500'; // Too low

      await writeFile(testConfigPath, JSON.stringify({ schedules: [] }));

      await expect(configManager.loadConfig(testConfigPath, true)).rejects.toThrow(
        /Browser timeout must be between 1000ms and 120000ms/
      );
    });

    it('should validate webhook URL when notifications are enabled', async () => {
      process.env.NOTIFICATIONS_ENABLED = 'true';
      process.env.WEBHOOK_URL = 'invalid-url';

      await writeFile(testConfigPath, JSON.stringify({ schedules: [] }));

      await expect(configManager.loadConfig(testConfigPath, true)).rejects.toThrow(
        /Invalid webhook URL format/
      );
    });

    it('should require webhook URL when notifications are enabled', async () => {
      process.env.NOTIFICATIONS_ENABLED = 'true';
      delete process.env.WEBHOOK_URL;

      await writeFile(testConfigPath, JSON.stringify({ schedules: [] }));

      await expect(configManager.loadConfig(testConfigPath, true)).rejects.toThrow(
        /Webhook URL is required when notifications are enabled/
      );
    });
  });

  describe('Schedule-Specific Configuration Loading', () => {
    it('should load configuration for specific schedule ID', async () => {
      const schedules: ReservationSchedule[] = [
        {
          id: 'schedule-1',
          dayToSelect: 'tomorrow',
          className: 'Class 1',
          reservationTime: '2024-12-09T17:00:00-03:00',
          bufferSeconds: 30,
          enabled: true
        },
        {
          id: 'schedule-2',
          dayToSelect: 'today',
          className: 'Class 2',
          reservationTime: '2024-12-09T18:00:00-03:00',
          bufferSeconds: 45,
          enabled: true
        }
      ];

      await writeFile(testConfigPath, JSON.stringify({ schedules }));

      const config = await configManager.loadConfigForSchedule('schedule-2', undefined, testConfigPath);

      expect(config.schedules).toHaveLength(1);
      expect(config.schedules[0].id).toBe('schedule-2');
      expect(config.schedules[0].className).toBe('Class 2');
    });

    it('should throw error for non-existent schedule ID', async () => {
      const schedules: ReservationSchedule[] = [
        {
          id: 'existing-schedule',
          dayToSelect: 'tomorrow',
          className: 'Test Class',
          reservationTime: '2024-12-09T17:00:00-03:00',
          bufferSeconds: 30,
          enabled: true
        }
      ];

      await writeFile(testConfigPath, JSON.stringify({ schedules }));

      await expect(configManager.loadConfigForSchedule('nonexistent', undefined, testConfigPath)).rejects.toThrow(
        "Schedule with ID 'nonexistent' not found"
      );
    });

    it('should apply parameter overrides to schedule', async () => {
      const schedule: ReservationSchedule = {
        id: 'test-schedule',
        dayToSelect: 'tomorrow',
        className: 'Original Class',
        reservationTime: '2024-12-09T17:00:00-03:00',
        bufferSeconds: 30,
        enabled: true
      };

      await writeFile(testConfigPath, JSON.stringify({ schedules: [schedule] }));

      const config = await configManager.loadConfigForSchedule('test-schedule', {
        className: 'Override Class',
        targetTime: '2024-12-09T18:00:00-03:00'
      }, testConfigPath);

      expect(config.schedules[0].className).toBe('Override Class');
      expect(config.schedules[0].reservationTime).toBe('2024-12-09T18:00:00-03:00');
    });
  });

  describe('Caching Behavior', () => {
    it('should cache configuration after first load', async () => {
      await writeFile(testConfigPath, JSON.stringify({ schedules: [] }));

      const config1 = await configManager.loadConfig(testConfigPath, true);
      const config2 = await configManager.loadConfig(testConfigPath, true);

      expect(config1).toBe(config2); // Same object reference
    });

    it('should return cached configuration with getCurrentConfig', async () => {
      await writeFile(testConfigPath, JSON.stringify({ schedules: [] }));

      expect(configManager.getCurrentConfig()).toBeNull();

      const config = await configManager.loadConfig(testConfigPath, true);
      const cachedConfig = configManager.getCurrentConfig();

      expect(cachedConfig).toBe(config);
    });

    it('should clear cache when requested', async () => {
      await writeFile(testConfigPath, JSON.stringify({ schedules: [] }));

      await configManager.loadConfig(testConfigPath, true);
      expect(configManager.getCurrentConfig()).not.toBeNull();

      configManager.clearCache();
      expect(configManager.getCurrentConfig()).toBeNull();
    });
  });

  describe('Validation Helper Methods', () => {
    it('should validate ISO datetime strings correctly', () => {
      const validConfig: ReservationConfig = {
        credentials: { email: 'test@example.com', password: 'password' },
        schedules: [
          {
            id: 'test',
            dayToSelect: 'tomorrow',
            className: 'Test',
            reservationTime: '2024-12-09T17:00:00-03:00',
            bufferSeconds: 30,
            enabled: true
          }
        ],
        notifications: { enabled: false },
        browser: { headless: true, timeout: 30000 },
        timezone: 'America/Santiago'
      };

      const validation = configManager.validateConfig(validConfig);
      expect(validation.isValid).toBe(true);

      // Test invalid datetime
      validConfig.schedules[0].reservationTime = 'invalid-date';
      const invalidValidation = configManager.validateConfig(validConfig);
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.errors.some(e => e.field.includes('reservationTime'))).toBe(true);
    });

    it('should validate cron expressions', () => {
      const validConfig: ReservationConfig = {
        credentials: { email: 'test@example.com', password: 'password' },
        schedules: [
          {
            id: 'test',
            dayToSelect: 'tomorrow',
            className: 'Test',
            reservationTime: '2024-12-09T17:00:00-03:00',
            bufferSeconds: 30,
            enabled: true,
            cronExpression: '0 17 * * 4'
          }
        ],
        notifications: { enabled: false },
        browser: { headless: true, timeout: 30000 },
        timezone: 'America/Santiago'
      };

      const validation = configManager.validateConfig(validConfig);
      expect(validation.isValid).toBe(true);

      // Test invalid cron
      validConfig.schedules[0].cronExpression = 'invalid cron';
      const invalidValidation = configManager.validateConfig(validConfig);
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.errors.some(e => e.field.includes('cronExpression'))).toBe(true);
    });
  });
});