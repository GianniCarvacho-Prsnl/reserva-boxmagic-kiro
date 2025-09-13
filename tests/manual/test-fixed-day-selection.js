import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

// Copiar la lógica actualizada para test independiente
async function testFixedDaySelection() {
  let browser, context, page;

  try {
    console.log('🧪 PROBANDO LA SELECCIÓN DE DÍA ARREGLADA...');
    
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

    console.log('\n📅 PROBANDO SELECCIÓN DE MAÑANA...');

    // Calcular el número del día de mañana
    const currentDate = new Date();
    const tomorrowDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    const targetDay = tomorrowDate.getDate().toString();
    
    console.log(`🎯 Buscando día número: ${targetDay} (mañana)`);

    // Screenshot antes
    await page.screenshot({ path: 'before-fixed-day-selection.png' });
    console.log('📸 Screenshot ANTES: before-fixed-day-selection.png');

    // Probar la nueva lógica de selección
    const daySelectors = [
      `text="${targetDay}"`,
      `text*="${targetDay}"`,
      `[data-day="${targetDay}"]`,
      `button:has-text("${targetDay}")`,
      `.day-${targetDay}`,
      `[aria-label*="${targetDay}"]`
    ];

    let dayClicked = false;
    
    for (const selector of daySelectors) {
      try {
        console.log(`🔍 Probando selector: ${selector}`);
        const dayElement = page.locator(selector).first();
        
        if (await dayElement.isVisible({ timeout: 2000 })) {
          const isEnabled = await dayElement.isEnabled({ timeout: 1000 });
          if (isEnabled) {
            console.log(`✅ Elemento clickeable encontrado: ${selector}`);
            
            await dayElement.click({ force: true });
            console.log(`🎯 CLICK EXITOSO en día ${targetDay} con selector: ${selector}`);
            
            dayClicked = true;
            break;
          } else {
            console.log(`⚠️ Elemento encontrado pero no clickeable: ${selector}`);
          }
        } else {
          console.log(`❌ Elemento no visible: ${selector}`);
        }
      } catch (selectorError) {
        console.log(`❌ Error con selector ${selector}: ${selectorError.message}`);
      }
    }

    if (!dayClicked) {
      console.log('🔧 Selectores estándar fallaron, probando JavaScript...');
      
      const jsResult = await page.evaluate((targetDay) => {
        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.trim();
          return text === targetDay && 
                 (el.tagName === 'BUTTON' || 
                  el.onclick || 
                  el.getAttribute('role') === 'button' ||
                  window.getComputedStyle(el).cursor === 'pointer');
        });
        
        if (elements.length > 0) {
          const element = elements[0];
          element.click();
          return { 
            success: true, 
            found: elements.length, 
            text: element.textContent,
            tagName: element.tagName,
            className: element.className
          };
        }
        
        return { success: false, found: 0 };
      }, targetDay);
      
      if (jsResult.success) {
        console.log(`🎯 JAVASCRIPT CLICK EXITOSO en día ${targetDay}:`, jsResult);
        dayClicked = true;
      } else {
        console.log(`❌ JavaScript también falló. Elementos encontrados: ${jsResult.found}`);
      }
    }

    // Screenshot después
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'after-fixed-day-selection.png' });
    console.log('📸 Screenshot DESPUÉS: after-fixed-day-selection.png');

    // Verificar que el cambio funcionó
    console.log('\n🔍 VERIFICANDO CAMBIO DE DÍA...');
    
    // Buscar clases visibles después del cambio
    const classElements = page.locator('h3, h4, [role="heading"]');
    const classCount = await classElements.count();
    console.log(`📋 Clases encontradas después del cambio: ${classCount}`);
    
    for (let i = 0; i < Math.min(classCount, 5); i++) {
      const classText = await classElements.nth(i).textContent();
      console.log(`  ${i + 1}. ${classText}`);
    }

    console.log(`\n🏆 RESULTADO: ${dayClicked ? 'ÉXITO' : 'FALLO'}`);
    
    if (dayClicked) {
      console.log(`✅ Se seleccionó correctamente el día ${targetDay} (mañana)`);
    } else {
      console.log(`❌ No se pudo seleccionar el día ${targetDay} (mañana)`);
    }

    console.log('\n⏳ Manteniendo navegador abierto 15 segundos...');
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

testFixedDaySelection();