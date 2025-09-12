// ConfigManager - External configuration management
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import type {
  ReservationConfig,
  ReservationSchedule,
  ConfigValidationResult,
  ConfigValidationError,
  FunctionParams,
  NotificationConfig
} from './types.js';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: ReservationConfig | null = null;

  private constructor() {
    // Load environment variables
    loadEnv();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from environment variables and optional config file
   */
  public async loadConfig(configFilePath?: string, skipScheduleValidation = false): Promise<ReservationConfig> {
    if (this.config) {
      return this.config;
    }

    // Load base configuration from environment variables
    const baseConfig = this.loadFromEnvironment();
    
    // Load schedules from config file if provided
    let schedules: ReservationSchedule[] = [];
    if (configFilePath && existsSync(configFilePath)) {
      schedules = await this.loadSchedulesFromFile(configFilePath);
    } else {
      // Try to load from default config.json location
      const defaultConfigPath = join(process.cwd(), 'config.json');
      if (existsSync(defaultConfigPath)) {
        schedules = await this.loadSchedulesFromFile(defaultConfigPath);
      }
    }

    this.config = {
      ...baseConfig,
      schedules
    };

    // Validate the complete configuration
    const validation = this.validateConfig(this.config, skipScheduleValidation);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed:\n${validation.errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}`);
    }

    return this.config;
  }

  /**
   * Load configuration for a specific schedule ID (for serverless functions)
   */
  public async loadConfigForSchedule(scheduleId: string, params?: FunctionParams, configFilePath?: string): Promise<ReservationConfig> {
    const fullConfig = await this.loadConfig(configFilePath);
    
    let targetSchedule = fullConfig.schedules.find(s => s.id === scheduleId);
    if (!targetSchedule) {
      throw new Error(`Schedule with ID '${scheduleId}' not found`);
    }

    // Apply parameter overrides if provided
    if (params) {
      targetSchedule = {
        ...targetSchedule,
        ...(params.className && { className: params.className }),
        ...(params.targetTime && { reservationTime: params.targetTime })
      };
    }

    return {
      ...fullConfig,
      schedules: [targetSchedule]
    };
  }

  /**
   * Load base configuration from environment variables
   */
  private loadFromEnvironment(): Omit<ReservationConfig, 'schedules'> {
    const email = process.env['BOXMAGIC_EMAIL'];
    const password = process.env['BOXMAGIC_PASSWORD'];

    if (!email || !password) {
      throw new Error('Missing required environment variables: BOXMAGIC_EMAIL and BOXMAGIC_PASSWORD must be set');
    }

    const webhookUrl = process.env['WEBHOOK_URL'];
    const notificationsEnabled = process.env['NOTIFICATIONS_ENABLED'] === 'true';

    const notifications: NotificationConfig = {
      enabled: notificationsEnabled
    };
    
    if (webhookUrl) {
      notifications.webhookUrl = webhookUrl;
    }

    return {
      credentials: {
        email,
        password
      },
      notifications,
      browser: {
        headless: process.env['BROWSER_HEADLESS'] !== 'false',
        timeout: parseInt(process.env['BROWSER_TIMEOUT'] || '30000', 10)
      },
      timezone: process.env['TIMEZONE'] || 'America/Santiago'
    };
  }

  /**
   * Load schedules from JSON configuration file
   */
  private async loadSchedulesFromFile(filePath: string): Promise<ReservationSchedule[]> {
    try {
      const fileContent = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      
      if (!parsed.schedules || !Array.isArray(parsed.schedules)) {
        throw new Error('Configuration file must contain a "schedules" array');
      }

      return parsed.schedules;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file ${filePath}: ${error.message}`);
      }
      throw new Error(`Failed to load configuration file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate the complete configuration
   */
  public validateConfig(config: ReservationConfig, skipScheduleValidation = false): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];

    // Validate credentials
    if (!config.credentials.email) {
      errors.push({ field: 'credentials.email', message: 'Email is required' });
    } else if (!this.isValidEmail(config.credentials.email)) {
      errors.push({ field: 'credentials.email', message: 'Invalid email format', value: config.credentials.email });
    }

    if (!config.credentials.password) {
      errors.push({ field: 'credentials.password', message: 'Password is required' });
    }

    // Validate schedules (skip for testing scenarios)
    if (!skipScheduleValidation) {
      if (!config.schedules || config.schedules.length === 0) {
        errors.push({ field: 'schedules', message: 'At least one schedule must be configured' });
      } else {
        config.schedules.forEach((schedule, index) => {
          const scheduleErrors = this.validateSchedule(schedule, index);
          errors.push(...scheduleErrors);
        });
      }
    } else if (config.schedules && config.schedules.length > 0) {
      // Still validate individual schedules if they exist
      config.schedules.forEach((schedule, index) => {
        const scheduleErrors = this.validateSchedule(schedule, index);
        errors.push(...scheduleErrors);
      });
    }

    // Validate browser config
    if (config.browser.timeout < 1000 || config.browser.timeout > 120000) {
      errors.push({ 
        field: 'browser.timeout', 
        message: 'Browser timeout must be between 1000ms and 120000ms',
        value: config.browser.timeout 
      });
    }

    // Validate timezone
    if (!this.isValidTimezone(config.timezone)) {
      errors.push({ 
        field: 'timezone', 
        message: 'Invalid timezone format. Use IANA timezone names like "America/Santiago"',
        value: config.timezone 
      });
    }

    // Validate webhook URL if notifications are enabled
    if (config.notifications.enabled && !config.notifications.webhookUrl) {
      errors.push({ field: 'notifications.webhookUrl', message: 'Webhook URL is required when notifications are enabled' });
    }

    if (config.notifications.webhookUrl && !this.isValidUrl(config.notifications.webhookUrl)) {
      errors.push({ 
        field: 'notifications.webhookUrl', 
        message: 'Invalid webhook URL format',
        value: config.notifications.webhookUrl 
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single schedule configuration
   */
  private validateSchedule(schedule: ReservationSchedule, index: number): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];
    const prefix = `schedules[${index}]`;

    if (!schedule.id) {
      errors.push({ field: `${prefix}.id`, message: 'Schedule ID is required' });
    }

    if (!schedule.className) {
      errors.push({ field: `${prefix}.className`, message: 'Class name is required' });
    }

    if (!schedule.reservationTime) {
      errors.push({ field: `${prefix}.reservationTime`, message: 'Reservation time is required' });
    } else if (!this.isValidISODateTime(schedule.reservationTime)) {
      errors.push({ 
        field: `${prefix}.reservationTime`, 
        message: 'Invalid ISO datetime format. Use format like "2024-09-19T17:00:00-03:00"',
        value: schedule.reservationTime 
      });
    }

    if (!['today', 'tomorrow'].includes(schedule.dayToSelect)) {
      errors.push({ 
        field: `${prefix}.dayToSelect`, 
        message: 'Day to select must be "today" or "tomorrow"',
        value: schedule.dayToSelect 
      });
    }

    if (schedule.bufferSeconds < 5 || schedule.bufferSeconds > 300) {
      errors.push({ 
        field: `${prefix}.bufferSeconds`, 
        message: 'Buffer seconds must be between 5 and 300',
        value: schedule.bufferSeconds 
      });
    }

    if (schedule.cronExpression && !this.isValidCronExpression(schedule.cronExpression)) {
      errors.push({ 
        field: `${prefix}.cronExpression`, 
        message: 'Invalid cron expression format',
        value: schedule.cronExpression 
      });
    }

    return errors;
  }

  /**
   * Validation helper methods
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidISODateTime(dateTime: string): boolean {
    try {
      const date = new Date(dateTime);
      return !isNaN(date.getTime()) && dateTime.includes('T');
    } catch {
      return false;
    }
  }

  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  private isValidCronExpression(cron: string): boolean {
    // Basic cron validation (5 or 6 parts)
    const parts = cron.trim().split(/\s+/);
    return parts.length === 5 || parts.length === 6;
  }

  /**
   * Get current configuration (cached)
   */
  public getCurrentConfig(): ReservationConfig | null {
    return this.config;
  }

  /**
   * Clear cached configuration (useful for testing)
   */
  public clearCache(): void {
    this.config = null;
  }
}