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