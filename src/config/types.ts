// Configuration type definitions for CrossFit reservation bot

export interface ReservationCredentials {
  email: string;
  password: string;
}

export interface ReservationSchedule {
  id: string;
  dayToSelect: 'today' | 'tomorrow';
  className: string;
  reservationHour: string; // HH:MM format
  reservationDay: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'any';
  bufferSeconds: number;
  enabled: boolean;
  cronExpression?: string;
  description?: string;
  // Backward compatibility (optional)
  reservationTime?: string; // ISO datetime string - deprecated
}

export interface NotificationConfig {
  webhookUrl?: string | undefined;
  enabled: boolean;
}

export interface BrowserConfig {
  headless: boolean;
  timeout: number;
}

export interface ReservationConfig {
  credentials: ReservationCredentials;
  schedules: ReservationSchedule[];
  notifications: NotificationConfig;
  browser: BrowserConfig;
  timezone: string;
}

export interface FunctionParams {
  scheduleId?: string;
  className?: string;
  targetTime?: string;
}

export interface ConfigValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: ConfigValidationError[];
}