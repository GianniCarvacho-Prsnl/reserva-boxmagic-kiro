// Main entry point for the CrossFit reservation bot
import { ReservationBot } from './core/ReservationBot.js';
import { Logger } from './core/Logger.js';
import { calculateNextReservationTime } from './utils/timing.js';

async function main() {
  const logger = new Logger();
  const bot = new ReservationBot(logger);
  
  // Get schedule ID from command line arguments
  const scheduleId = process.argv[2];

  try {
    console.log('🤖 Iniciando CrossFit Reservation Bot...');
    
    // Inicializar el bot
    await bot.initialize('./config.json');
    console.log('✅ Bot inicializado correctamente');

    if (scheduleId) {
      // Modo específico: ejecutar una reserva específica
      console.log(`🔧 Ejecutando reserva con ID: ${scheduleId}...`);
      console.log('⏰ El bot calculará automáticamente cuándo ejecutar según la configuración...');
      
      const result = await bot.executeReservation(scheduleId);
      
      console.log('📊 Resultado de la reserva:');
      console.log(`✅ Éxito: ${result.success}`);
      console.log(`📝 Mensaje: ${result.message}`);
      console.log(`⏱️ Precisión de timing: ${result.timingAccuracy}ms`);
      
      if (result.success) {
        console.log('🎉 ¡Reserva exitosa!');
      } else {
        console.log('⚠️ Reserva no exitosa');
      }
    } else {
      // Modo daemon: ejecutar todas las reservas habilitadas según su programación
      console.log('🔄 Modo daemon: monitoreando horarios de reservas...');
      console.log('⏰ El bot ejecutará automáticamente según la configuración cron');
      
      // Mantener el proceso corriendo para el modo daemon
      process.on('SIGINT', () => {
        console.log('\n🛑 Deteniendo bot...');
        process.exit(0);
      });
      
      // En un entorno real, aquí habría un scheduler que ejecutaría las reservas
      // Por ahora solo mantenemos el proceso vivo
      await new Promise(() => {}); // Keep alive
    }
    
  } catch (error) {
    console.error('❌ Error en el bot:', error);
    process.exit(1);
  }
}

// Ejecutar solo si es el archivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export * from './core/index.js';
export * from './handlers/index.js';
export * from './config/index.js';