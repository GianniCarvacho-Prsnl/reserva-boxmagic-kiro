// Main entry point for the CrossFit reservation bot
import { ReservationBot } from './core/ReservationBot.js';
import { Logger } from './core/Logger.js';

async function main() {
  const logger = new Logger();
  const bot = new ReservationBot(logger);

  try {
    console.log('🤖 Iniciando CrossFit Reservation Bot...');
    
    // Inicializar el bot
    await bot.initialize('./config.json');
    console.log('✅ Bot inicializado correctamente');

    // Ejecutar reserva (esto incluye login, navegación, etc.)
    console.log('🔧 Ejecutando reserva de prueba...');
    const result = await bot.executeReservation('crossfit-domingo-18');
    
    console.log('📊 Resultado de la reserva:');
    console.log(`✅ Éxito: ${result.success}`);
    console.log(`📝 Mensaje: ${result.message}`);
    console.log(`⏱️ Tiempo: ${result.timingAccuracy}ms`);
    
    if (result.success) {
      console.log('🎉 ¡Reserva exitosa!');
    } else {
      console.log('⚠️ Reserva no exitosa (esto es normal en modo de prueba)');
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