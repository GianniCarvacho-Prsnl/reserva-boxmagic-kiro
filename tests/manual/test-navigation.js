// Script de prueba para ver la navegación del bot
import { ReservationBot } from './dist/core/ReservationBot.js';
import { Logger } from './dist/core/Logger.js';

async function testNavigation() {
  console.log('🚀 Iniciando prueba de navegación...');
  
  const logger = new Logger();
  const bot = new ReservationBot(logger);
  
  try {
    // Inicializar el bot
    console.log('📋 Inicializando bot...');
    await bot.initialize('./config.json');
    
    // Ejecutar una reserva de prueba
    console.log('🎯 Ejecutando reserva de prueba...');
    const result = await bot.executeReservation('test-clase');
    
    console.log('✅ Resultado:', result);
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  } finally {
    console.log('🏁 Prueba completada');
  }
}

// Ejecutar la prueba
testNavigation().catch(console.error);