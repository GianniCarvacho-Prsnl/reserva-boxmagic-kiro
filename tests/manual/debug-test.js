// Script de debug para ver exactamente qué pasa
import { ReservationBot } from './dist/core/ReservationBot.js';
import { Logger } from './dist/core/Logger.js';

async function debugTest() {
  console.log('🔍 INICIANDO DEBUG TEST...');
  console.log('⏰ Hora actual:', new Date().toISOString());
  
  const logger = new Logger();
  const bot = new ReservationBot(logger);
  
  try {
    console.log('📋 1. Inicializando bot...');
    await bot.initialize('./config.json');
    console.log('✅ Bot inicializado correctamente');
    
    console.log('📅 2. Verificando configuración...');
    // Aquí podríamos verificar la config cargada
    
    console.log('🎯 3. Ejecutando reserva...');
    const result = await bot.executeReservation('test-clase');
    
    console.log('📊 RESULTADO FINAL:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ ERROR CAPTURADO:');
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('🏁 Debug completado');
}

debugTest().catch(console.error);