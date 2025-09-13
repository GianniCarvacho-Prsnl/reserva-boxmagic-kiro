// Test detallado para ver cada paso del proceso
import { config } from 'dotenv';
import { WebAutomationEngine } from './dist/core/WebAutomationEngine.js';
import { Logger } from './dist/core/Logger.js';

// Cargar variables de entorno
config();

async function testDetailed() {
  console.log('🔍 TEST DETALLADO - Vamos a ver cada paso');
  
  const logger = new Logger();
  const webEngine = new WebAutomationEngine(logger);
  
  try {
    console.log('🌐 Paso 1: Inicializando navegador...');
    await webEngine.initialize();
    console.log('✅ Navegador inicializado');
    
    console.log('🔐 Paso 2: Intentando login...');
    const email = process.env.BOXMAGIC_EMAIL;
    const password = process.env.BOXMAGIC_PASSWORD;
    console.log('📧 Email:', email);
    
    const loginSuccess = await webEngine.login(email, password);
    console.log('📊 Login exitoso:', loginSuccess);
    
    if (loginSuccess) {
      console.log('📅 Paso 3: Navegando a horarios...');
      await webEngine.navigateToSchedule();
      console.log('✅ Navegación a horarios completada');
      
      console.log('🎯 Paso 4: Seleccionando día (today)...');
      await webEngine.selectDay('today');
      console.log('✅ Día seleccionado');
      
      console.log('⏳ Esperando 15 segundos para que veas las clases disponibles...');
      console.log('👀 MIRA EL NAVEGADOR AHORA - deberías ver las clases de hoy');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      console.log('🔍 Verificando si hay clases cargadas...');
      const classesLoaded = await webEngine.verifyClassListLoaded();
      console.log('📊 Clases cargadas:', classesLoaded);
    }
    
  } catch (error) {
    console.error('❌ ERROR en test detallado:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    console.log('🧹 Limpiando recursos...');
    await webEngine.cleanup();
  }
}

testDetailed().catch(console.error);