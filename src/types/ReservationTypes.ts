// Reservation-related type definitions

export interface ReservationResult {
  success: boolean;
  message: string;
  timestamp: Date;
  timingAccuracy: number; // milisegundos de diferencia del tiempo objetivo
  hasSpots: boolean;
  participantCount?: string; // ej: "5/15"
  classStatus: 'available' | 'full' | 'already_booked';
}

export interface TimingMetrics {
  preparationDuration: number; // Tiempo total de preparación
  executionDuration: number;   // Tiempo de ejecución crítica
  targetAccuracy: number;      // Diferencia del tiempo objetivo (ms)
  totalDuration: number;       // Tiempo total del proceso
}

export interface ExecutionResult<T> {
  result: T;
  duration: number;
  accuracy?: number;
}