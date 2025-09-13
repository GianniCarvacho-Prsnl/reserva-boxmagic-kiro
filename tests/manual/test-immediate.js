// Prueba INMEDIATA - Sin esperar timing
import { WebAutomationEngine } from './dist/core/WebAutomationEngine.js';
import { Logger } from './dist/core/Logger.js';
import { ConfigManager } from './dist/config/ConfigManager.js';

async function testImmediate() {
  console.log('🚀 PRUEBA INMEDIATA - Sin esperar timing');
  
  const logger = new Logger();
  const webEngine = new WebAutomationEngine(logger);
  
  try {
    // Cargar configuración
    const configManager = ConfigManager.getInstance();
    const config = await configManager.loadConfig('./config.json');
    
    console.log('📋 Configuración cargada:', {
      email: process.env.BOXMAGIC_EMAIL,
      className: config.schedules[0].className,
      dayToSelect: config.schedules[0].dayToSelect
    });
    
    // Inicializar navegador
    console.log('🌐 Inicializando navegador...');
    await webEngine.initialize();
    
    // Ejecutar navegación INMEDIATAMENTE
    console.log('🎯 Ejecutando navegación inmediata...');
    
    const schedule = config.schedules[0];
    const result = await webEngine.executeReservation(
      schedule.className,
      schedule.dayToSelect
    );
    
    console.log('✅ RESULTADO:', result);
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    console.log('🧹 Limpiando recursos...');
    await webEngine.cleanup();
  }
}

testImmediate().catch(console.error);