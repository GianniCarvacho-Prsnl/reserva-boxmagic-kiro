// Test que maneja el botón "Reintentar"
import { config } from 'dotenv';
import { WebAutomationEngine } from './dist/core/WebAutomationEngine.js';
import { Logger } from './dist/core/Logger.js';

config();

async function testWithRetry() {
  console.log('🔄 TEST CON REINTENTAR - Manejando error de BoxMagic');
  
  const logger = new Logger();
  const webEngine = new WebAutomationEngine(logger);
  
  try {
    console.log('🌐 Inicializando navegador con configuración mejorada...');
    await webEngine.initialize();
    
    console.log('📅 Navegando a BoxMagic...');
    await webEngine.navigateToSchedule();
    
    // Esperar un poco para que cargue
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🔍 Verificando si aparece el error "No fue posible inicializar la app"...');
    
    // Buscar el botón "Reintentar"
    const page = webEngine.page;
    const retryButton = await page.$('button:has-text("Reintentar")');
    
    if (retryButton) {
      console.log('🔄 Encontrado botón "Reintentar", haciendo clic...');
      await retryButton.click();
      
      // Esperar a que se recargue
      console.log('⏳ Esperando recarga...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('✅ No se encontró error, la página cargó correctamente');
    }
    
    console.log('🎯 Intentando seleccionar día...');
    await webEngine.selectDay('today');
    
    console.log('⏳ Esperando 15 segundos para ver el resultado...');
    console.log('👀 MIRA EL NAVEGADOR - ¿ves las clases ahora?');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    console.log('🧹 Limpiando...');
    await webEngine.cleanup();
  }
}

testWithRetry().catch(console.error);