import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

async function testAllDaySelectors() {
  let browser, context, page;

  try {
    console.log('🔍 ANALIZANDO TODOS LOS SELECTORES DE DÍA...');
    
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: 'es-CL',
      timezoneId: 'America/Santiago'
    });

    page = await context.newPage();
    
    // Login
    console.log('🔐 Login...');
    await page.goto('https://members.boxmagic.app/acceso/ingreso');
    await page.waitForTimeout(5000);

    if (!page.url().includes('/horarios')) {
      await page.getByRole('textbox', { name: 'Correo' }).fill(process.env.BOXMAGIC_EMAIL);
      await page.getByRole('textbox', { name: 'Contraseña' }).fill(process.env.BOXMAGIC_PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForFunction(() => window.location.pathname.includes('/horarios'), { timeout: 15000 });
    }

    // Cerrar popups
    await page.waitForTimeout(3000);
    try {
      const popup = page.locator('dialog.zonaModal').first();
      if (await popup.isVisible({ timeout: 2000 })) {
        await page.locator('dialog.zonaModal .elModal-nucleo-cerrador').first().click();
      }
    } catch {}

    console.log('\n🔍 BUSCANDO TODOS LOS POSIBLES SELECTORES DE DÍA...\n');

    // 1. Buscar botones "Hoy" y "Mañana"
    console.log('=== BOTONES HOY/MAÑANA ===');
    const patterns = [
      '.Ui2Boton:has-text("Hoy")',
      '.Ui2Boton:has-text("Mañana")', 
      'button:has-text("Hoy")',
      'button:has-text("Mañana")',
      'text="Hoy"',
      'text="Mañana"',
      '[aria-label*="Hoy"]',
      '[aria-label*="Mañana"]'
    ];

    for (const pattern of patterns) {
      try {
        const element = page.locator(pattern).first();
        const visible = await element.isVisible({ timeout: 1000 });
        console.log(`${visible ? '✅' : '❌'} ${pattern}: ${visible ? 'VISIBLE' : 'NO VISIBLE'}`);
        
        if (visible) {
          const text = await element.textContent();
          const classes = await element.getAttribute('class');
          console.log(`   Texto: "${text}"`);
          console.log(`   Clases: "${classes}"`);
        }
      } catch (e) {
        console.log(`❌ ${pattern}: ERROR`);
      }
    }

    // 2. Buscar selectores de fecha (SAB13, DOM14, etc.)
    console.log('\n=== SELECTORES DE FECHA ===');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const todayNum = today.getDate();
    const tomorrowNum = tomorrow.getDate();
    const todayDay = today.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().slice(0, 3);
    const tomorrowDay = tomorrow.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().slice(0, 3);
    
    console.log(`Hoy: ${todayDay}${todayNum}, Mañana: ${tomorrowDay}${tomorrowNum}`);

    const datePatterns = [
      `text="${todayDay}${todayNum}"`,
      `text="${tomorrowDay}${tomorrowNum}"`,
      `text="${todayDay} ${todayNum}"`,
      `text="${tomorrowDay} ${tomorrowNum}"`,
      `text*="${todayNum}"`,
      `text*="${tomorrowNum}"`,
      `[data-date*="${todayNum}"]`,
      `[data-date*="${tomorrowNum}"]`
    ];

    for (const pattern of datePatterns) {
      try {
        const element = page.locator(pattern).first();
        const visible = await element.isVisible({ timeout: 1000 });
        console.log(`${visible ? '✅' : '❌'} ${pattern}: ${visible ? 'VISIBLE' : 'NO VISIBLE'}`);
        
        if (visible) {
          const text = await element.textContent();
          const classes = await element.getAttribute('class');
          console.log(`   Texto: "${text}"`);
          console.log(`   Clases: "${classes}"`);
        }
      } catch (e) {
        console.log(`❌ ${pattern}: ERROR`);
      }
    }

    // 3. Buscar TODOS los elementos clickeables con números
    console.log('\n=== TODOS LOS ELEMENTOS CON NÚMEROS ===');
    const numberElements = page.locator(`text=/\\d{1,2}/`);
    const count = await numberElements.count();
    console.log(`Total elementos con números: ${count}`);
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = numberElements.nth(i);
      const text = await element.textContent();
      const isClickable = await element.isEnabled();
      const classes = await element.getAttribute('class');
      console.log(`${i + 1}. "${text}" - Clickeable: ${isClickable} - Clases: "${classes}"`);
    }

    // 4. Ejecutar JavaScript para encontrar TODOS los elementos
    console.log('\n=== ANÁLISIS CON JAVASCRIPT ===');
    const allInteractiveElements = await page.evaluate(() => {
      const results = [];
      
      // Buscar todos los elementos clickeables
      const clickables = document.querySelectorAll('button, [role="button"], .clickable, [onclick], [data-click]');
      
      clickables.forEach((el, index) => {
        const text = el.textContent?.trim();
        const classes = el.className;
        const tag = el.tagName;
        
        if (text && (text.includes('Hoy') || text.includes('Mañana') || /\d{1,2}/.test(text))) {
          results.push({
            index,
            text,
            classes,
            tag,
            id: el.id,
            dataset: Object.keys(el.dataset).length > 0 ? el.dataset : null
          });
        }
      });
      
      return results;
    });

    console.log('Elementos interactivos encontrados:');
    allInteractiveElements.forEach((el, i) => {
      console.log(`${i + 1}. [${el.tag}] "${el.text}" - ID: "${el.id}" - Clases: "${el.classes}"`);
      if (el.dataset) console.log(`   Dataset:`, el.dataset);
    });

    // 5. Tomar screenshot para análisis visual
    await page.screenshot({ path: 'all-day-selectors-analysis.png', fullPage: true });
    console.log('\n📸 Screenshot guardado: all-day-selectors-analysis.png');

    console.log('\n⏳ Manteniendo navegador abierto 15 segundos para análisis visual...');
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

testAllDaySelectors();