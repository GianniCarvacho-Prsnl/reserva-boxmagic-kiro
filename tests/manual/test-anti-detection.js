// Test anti-detección - Probar con IDs dinámicos
import { config } from 'dotenv';
import { WebAutomationEngine } from './dist/core/WebAutomationEngine.js';
import { Logger } from './dist/core/Logger.js';

config();

async function testAntiDetection() {
  console.log('🛡️  TEST ANTI-DETECCIÓN - Probando selectores robustos');
  
  const logger = new Logger();
  const webEngine = new WebAutomationEngine(logger);
  
  try {
    console.log('🌐 Inicializando navegador...');
    await webEngine.initialize();
    
    console.log('🔐 Haciendo login...');
    const email = process.env.BOXMAGIC_EMAIL;
    const password = process.env.BOXMAGIC_PASSWORD;
    
    const loginSuccess = await webEngine.login(email, password);
    console.log('📊 Login exitoso:', loginSuccess);
    
    if (loginSuccess) {
      console.log('📅 Navegando a horarios...');
      await webEngine.navigateToSchedule();
      
      console.log('🎯 Seleccionando día (today)...');
      await webEngine.selectDay('today');
      
      console.log('🔍 Verificando si encuentra "Gymnastics"...');
      const gymnastics = await webEngine.verifyClassExists('Gymnastics');
      console.log('📊 Gymnastics encontrado:', gymnastics);
      
      console.log('🔍 Verificando si encuentra "CrossFit"...');
      const crossfit = await webEngine.verifyClassExists('CrossFit');
      console.log('📊 CrossFit encontrado:', crossfit);
      
      console.log('🔍 Verificando si encuentra "Weightlifting"...');
      const weightlifting = await webEngine.verifyClassExists('Weightlifting');
      console.log('📊 Weightlifting encontrado:', weightlifting);
      
      if (gymnastics) {
        console.log('🎯 Intentando reservar Gymnastics...');
        const result = await webEngine.executeReservation('Gymnastics');
        console.log('📊 Resultado reserva:', result);
      }
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    console.log('🧹 Limpiando...');
    await webEngine.cleanup();
  }
}

testAntiDetection().catch(console.error);