// Test completo del flujo: Login -> Navegación -> Reserva Gymnastics
import { config } from 'dotenv';
import { WebAutomationEngine } from './dist/core/WebAutomationEngine.js';
import { Logger } from './dist/core/Logger.js';
import { ConfigManager } from './dist/config/ConfigManager.js';

config();

async function testFullFlow() {
  console.log('🎯 TEST FLUJO COMPLETO - Login + Reserva Gymnastics');
  
  const logger = new Logger();
  const webEngine = new WebAutomationEngine(logger);
  
  try {
    // 1. Cargar configuración
    console.log('📋 1. Cargando configuración...');
    const configManager = ConfigManager.getInstance();
    const appConfig = await configManager.loadConfig('./config.json');
    const schedule = appConfig.schedules[0];
    
    console.log('📊 Configuración:', {
      email: process.env.BOXMAGIC_EMAIL,
      className: schedule.className,
      dayToSelect: schedule.dayToSelect,
      reservationTime: schedule.reservationTime
    });
    
    // 2. Inicializar navegador
    console.log('🌐 2. Inicializando navegador...');
    await webEngine.initialize();
    
    // 3. Hacer login
    console.log('🔐 3. Haciendo login...');
    const loginSuccess = await webEngine.login(
      process.env.BOXMAGIC_EMAIL,
      process.env.BOXMAGIC_PASSWORD
    );
    
    if (!loginSuccess) {
      throw new Error('Login falló');
    }
    console.log('✅ Login exitoso');
    
    // 4. Navegar a horarios (si no estamos ya ahí)
    console.log('📅 4. Navegando a horarios...');
    await webEngine.navigateToSchedule();
    
    // 5. Seleccionar día
    console.log('🗓️ 5. Seleccionando día:', schedule.dayToSelect);
    await webEngine.selectDay(schedule.dayToSelect);
    
    // 6. Esperar un momento para que carguen las clases
    console.log('⏳ 6. Esperando que carguen las clases...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 7. Verificar que la clase existe
    console.log('🔍 7. Verificando que existe la clase:', schedule.className);
    const classExists = await webEngine.verifyClassExists(schedule.className);
    
    if (!classExists) {
      throw new Error(`Clase "${schedule.className}" no encontrada`);
    }
    console.log('✅ Clase encontrada');
    
    // 8. Ejecutar reserva
    console.log('🎯 8. Ejecutando reserva de:', schedule.className);
    const result = await webEngine.executeReservation(schedule.className);
    
    console.log('🎉 RESULTADO FINAL:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('🎊 ¡RESERVA EXITOSA!');
    } else {
      console.log('❌ Reserva falló:', result.message);
    }
    
  } catch (error) {
    console.error('💥 ERROR EN EL FLUJO:');
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    console.log('🧹 Limpiando recursos...');
    await webEngine.cleanup();
    console.log('🏁 Test completado');
  }
}

testFullFlow().catch(console.error);