// Debug: ¿Qué página estamos viendo?
import { config } from 'dotenv';
import { WebAutomationEngine } from './dist/core/WebAutomationEngine.js';
import { Logger } from './dist/core/Logger.js';

config();

async function debugPage() {
  console.log('🔍 DEBUG: ¿Qué página estamos viendo?');
  
  const logger = new Logger();
  const webEngine = new WebAutomationEngine(logger);
  
  try {
    console.log('🌐 Inicializando...');
    await webEngine.initialize();
    
    console.log('🔐 Login...');
    const loginSuccess = await webEngine.login(
      process.env.BOXMAGIC_EMAIL,
      process.env.BOXMAGIC_PASSWORD
    );
    
    if (loginSuccess) {
      console.log('📅 Navegando a horarios...');
      await webEngine.navigateToSchedule();
      
      console.log('⏳ Esperando...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Debug: ¿Qué URL tenemos?
      const url = webEngine.page.url();
      console.log('🌐 URL actual:', url);
      
      // Debug: ¿Qué título tiene la página?
      const title = await webEngine.page.title();
      console.log('📄 Título:', title);
      
      // Debug: ¿Hay algún texto visible?
      const bodyText = await webEngine.page.locator('body').textContent();
      const firstChars = bodyText?.substring(0, 200) || 'No text found';
      console.log('📝 Primeros 200 caracteres:', firstChars);
      
      // Debug: ¿Cuántos elementos con texto "Gymnastics" hay?
      const gymnasticsCount = await webEngine.page.locator('*:has-text("Gymnastics")').count();
      console.log('🔢 Elementos con "Gymnastics":', gymnasticsCount);
      
      // Debug: ¿Cuántos elementos con texto "CrossFit" hay?
      const crossfitCount = await webEngine.page.locator('*:has-text("CrossFit")').count();
      console.log('🔢 Elementos con "CrossFit":', crossfitCount);
      
      // Debug: Tomar screenshot
      await webEngine.page.screenshot({ path: 'debug-screenshot.png' });
      console.log('📸 Screenshot guardado como debug-screenshot.png');
      
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    console.log('🧹 Limpiando...');
    await webEngine.cleanup();
  }
}

debugPage().catch(console.error);