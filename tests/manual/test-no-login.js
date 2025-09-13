// Test sin login - asumiendo que ya estás logueado
import { config } from 'dotenv';
import { WebAutomationEngine } from './dist/core/WebAutomationEngine.js';
import { Logger } from './dist/core/Logger.js';

config();

async function testNoLogin() {
  console.log('🔍 TEST SIN LOGIN - Asumiendo que ya estás logueado');
  
  const logger = new Logger();
  const webEngine = new WebAutomationEngine(logger);
  
  try {
    console.log('🌐 Inicializando navegador...');
    await webEngine.initialize();
    
    console.log('📅 Navegando directamente a horarios...');
    await webEngine.navigateToSchedule();
    
    console.log('🎯 Seleccionando día (today)...');
    await webEngine.selectDay('today');
    
    console.log('⏳ Esperando 10 segundos para que veas las clases...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('🔍 Verificando clases disponibles...');
    const classesLoaded = await webEngine.verifyClassListLoaded();
    console.log('📊 Clases cargadas:', classesLoaded);
    
    // Probar con una clase específica
    console.log('🎯 Probando reserva de CrossFit...');
    const result = await webEngine.executeReservation('CrossFit');
    console.log('📊 Resultado:', result);
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    console.log('🧹 Limpiando...');
    await webEngine.cleanup();
  }
}

testNoLogin().catch(console.error);