// Test usando los selectores exactos que vimos en MCP
import { config } from 'dotenv';
import { WebAutomationEngine } from './dist/core/WebAutomationEngine.js';
import { Logger } from './dist/core/Logger.js';

config();

async function testMCPSelectors() {
  console.log('🎯 TEST SELECTORES MCP - Usando selectores exactos');
  
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
      
      // Probar selectores basados en lo que vimos en MCP
      console.log('🔍 Probando selectores MCP...');
      
      // Selector 1: heading con level="2"
      try {
        const headings = await webEngine.page.locator('heading[level="2"]').all();
        console.log(`📊 Headings con level="2": ${headings.length}`);
        
        for (let i = 0; i < Math.min(headings.length, 10); i++) {
          const text = await headings[i].textContent();
          console.log(`  ${i + 1}. "${text}"`);
        }
      } catch (error) {
        console.log('❌ Error con heading[level="2"]:', error.message);
      }
      
      // Selector 2: Buscar "Gymnastics" específicamente
      console.log('\n🎯 Buscando "Gymnastics" específicamente...');
      try {
        const gymnastics = await webEngine.page.locator('heading[level="2"]:has-text("Gymnastics")').first();
        const isVisible = await gymnastics.isVisible({ timeout: 2000 });
        console.log(`📊 Gymnastics con heading[level="2"]: ${isVisible ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}`);
      } catch (error) {
        console.log('❌ Error buscando Gymnastics:', error.message);
      }
      
      // Selector 3: Buscar por cualquier elemento que contenga el texto
      console.log('\n🔍 Buscando por cualquier elemento...');
      const classNames = ['Gymnastics', 'Weightlifting', '19:00 CrossFit', 'Competitor'];
      
      for (const className of classNames) {
        try {
          const element = await webEngine.page.locator(`*:has-text("${className}")`).first();
          const isVisible = await element.isVisible({ timeout: 1000 });
          console.log(`📊 ${className}: ${isVisible ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}`);
        } catch {
          console.log(`📊 ${className}: ❌ ERROR`);
        }
      }
      
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    console.log('🧹 Limpiando...');
    await webEngine.cleanup();
  }
}

testMCPSelectors().catch(console.error);