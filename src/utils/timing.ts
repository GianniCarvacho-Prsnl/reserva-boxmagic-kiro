// Timing utility functions

/**
 * Calculate when to start preparation phase before target time
 */
export const calculatePreparationTime = (targetTime: Date, bufferSeconds: number = 30): Date => {
  const bufferMs = bufferSeconds * 1000;
  return new Date(targetTime.getTime() - bufferMs);
};

/**
 * Parse ISO datetime string to Date object
 */
export const parseReservationTime = (isoString: string): Date => {
  return new Date(isoString);
};

/**
 * Convert reservationHour + reservationDay to next occurrence Date
 */
export const calculateNextReservationTime = (hour: string, dayName: string, timezone: string = 'America/Santiago'): Date => {
  const [hourNum, minuteNum] = hour.split(':').map(Number);
  
  const dayMap: { [key: string]: number } = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };
  
  if (dayName === 'any') {
    // Para testing - usar fecha actual + 1 minuto
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now;
  }
  
  const targetDayOfWeek = dayMap[dayName];
  if (targetDayOfWeek === undefined) {
    throw new Error(`Invalid day name: ${dayName}`);
  }
  
  const now = new Date();
  const currentDayOfWeek = now.getDay();
  
  // Calcular días hasta el próximo día objetivo
  let daysUntilTarget = targetDayOfWeek - currentDayOfWeek;
  if (daysUntilTarget < 0) {
    daysUntilTarget += 7; // Próxima semana
  } else if (daysUntilTarget === 0) {
    // Es hoy - verificar si ya pasó la hora
    const todayAtTargetTime = new Date(now);
    todayAtTargetTime.setHours(hourNum, minuteNum, 0, 0);
    
    if (todayAtTargetTime.getTime() <= now.getTime()) {
      // Ya pasó la hora hoy, usar próxima semana
      daysUntilTarget = 7;
    }
  }
  
  // Crear fecha objetivo
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntilTarget);
  targetDate.setHours(hourNum, minuteNum, 0, 0);
  
  return targetDate;
};

/**
 * Check if target time is in the future
 */
export const isTargetTimeValid = (targetTime: Date): boolean => {
  return targetTime.getTime() > Date.now();
};

/**
 * Format time difference in human readable format
 */
export const formatTimeDifference = (milliseconds: number): string => {
  const absMs = Math.abs(milliseconds);
  const seconds = Math.floor(absMs / 1000);
  const ms = absMs % 1000;
  
  if (seconds > 0) {
    return `${milliseconds < 0 ? '-' : ''}${seconds}.${ms.toString().padStart(3, '0')}s`;
  }
  return `${milliseconds < 0 ? '-' : ''}${ms}ms`;
};

/**
 * Create a promise that resolves after specified milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * High precision sleep using busy waiting for the last millisecond
 */
export const precisionSleep = async (ms: number): Promise<void> => {
  if (ms > 10) {
    // Use regular setTimeout for most of the wait
    await sleep(ms - 10);
  }
  
  // Busy wait for the last 10ms for higher precision
  const targetTime = Date.now() + (ms > 10 ? 10 : ms);
  while (Date.now() < targetTime) {
    // Busy wait
  }
};