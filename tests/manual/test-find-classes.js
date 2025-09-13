// Test simple para encontrar clases
import { config } from 'dotenv';
import { WebAutomationEngine } from './dist/core/WebAutomationEngine.js';
import { Logger } from './dist/core/Logger.js';

config();

async function testFindClasses() {
  console.log('🔍 TEST ENCONTRAR CLASES');
  
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
      
      console.log('⏳ Esperando que carguen las clases...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Buscar todas las clases por texto directo
      console.log('🔍 Buscando clases por texto...');
      
      const classNames = ['Gymnastics', 'CrossFit', 'Weightlifting', 'Competitor', 'Functional'];
      
      for (const className of classNames) {
        try {
          const element = await webEngine.page.getByText(className).first();
          const isVisible = await element.isVisible({ timeout: 1000 });
          console.log(`📊 ${className}: ${isVisible ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}`);
        } catch {
          console.log(`📊 ${className}: ❌ ERROR`);
        }
      }
      
      // Buscar headings nivel 2
      console.log('\n🔍 Buscando headings nivel 2...');
      try {
        const headings = await webEngine.page.locator('h2, [role="heading"][level="2"]').all();
        console.log(`📊 Encontrados ${headings.length} headings nivel 2`);
        
        for (let i = 0; i < Math.min(headings.length, 10); i++) {
          const text = await headings[i].textContent();
          console.log(`  ${i + 1}. "${text}"`);
        }
      } catch (error) {
        console.log('❌ Error buscando headings:', error.message);
      }
      
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    console.log('🧹 Limpiando...');
    await webEngine.cleanup();
  }
}

testFindClasses().catch(console.error);