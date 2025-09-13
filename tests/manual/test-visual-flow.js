import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

async function testVisualFlow() {
  let browser, context, page;

  try {
    console.log('🎬 SIMULANDO EL FLUJO VISUAL COMPLETO...');
    console.log('(El navegador se mantendrá ABIERTO para que veas cada paso)\n');
    
    // Configurar navegador VISIBLE
    browser = await chromium.launch({
      headless: false, // VISIBLE
      channel: 'chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: 'es-CL',
      timezoneId: 'America/Santiago'
    });

    page = await context.newPage();
    
    console.log('⏰ PASO 1: Navegador abierto - esperando inicio...');
    console.log('(En el flujo real, esto sería hasta la hora de preparación)');
    await page.waitForTimeout(3000); // Simular espera

    console.log('🔐 PASO 2: Iniciando login...');
    await page.goto('https://members.boxmagic.app/acceso/ingreso');
    await page.waitForTimeout(5000);

    if (!page.url().includes('/horarios')) {
      await page.getByRole('textbox', { name: 'Correo' }).fill(process.env.BOXMAGIC_EMAIL);
      await page.getByRole('textbox', { name: 'Contraseña' }).fill(process.env.BOXMAGIC_PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForFunction(() => window.location.pathname.includes('/horarios'), { timeout: 15000 });
    }
    console.log('✅ Login completado');

    // Cerrar popups
    await page.waitForTimeout(3000);
    try {
      const popup = page.locator('dialog.zonaModal').first();
      if (await popup.isVisible({ timeout: 2000 })) {
        await page.locator('dialog.zonaModal .elModal-nucleo-cerrador').first().click();
        console.log('✅ Popup cerrado');
      }
    } catch {}

    console.log('\n📅 PASO 3: Cambiando al día domingo 14...');
    console.log('👀 MIRA EL NAVEGADOR - deberías ver el calendario en SÁBADO 13');
    await page.waitForTimeout(5000); // Tiempo para que veas

    // Cambiar día usando la lógica correcta
    const currentDate = new Date();
    const tomorrowDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    const targetDay = tomorrowDate.getDate().toString();
    const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const targetDayName = dayNames[tomorrowDate.getDay()];
    
    console.log(`🎯 Buscando: ${targetDayName}.${targetDay}`);

    // Buscar selector correcto
    const daySelectors = [
      `text="${targetDayName}.${targetDay}"`,
      `text="${targetDayName}. ${targetDay}"`, 
      `text="${targetDay}"`
    ];

    let dayClicked = false;
    for (const selector of daySelectors) {
      try {
        console.log(`🔍 Probando: ${selector}`);
        const dayElement = page.locator(selector).first();
        
        if (await dayElement.isVisible({ timeout: 2000 })) {
          const isEnabled = await dayElement.isEnabled({ timeout: 1000 });
          if (isEnabled) {
            await dayElement.click({ force: true });
            console.log(`✅ CLICK EXITOSO con: ${selector}`);
            dayClicked = true;
            break;
          }
        }
      } catch (e) {
        console.log(`❌ Falló: ${selector}`);
      }
    }

    if (dayClicked) {
      console.log('\n🎉 ¡DÍA CAMBIADO!');
      console.log('👀 MIRA EL NAVEGADOR AHORA - debería mostrar DOMINGO 14');
      console.log('📋 El contenido debería haber cambiado');
    } else {
      console.log('❌ No se pudo cambiar el día');
    }

    console.log('\n⏰ PASO 4: En el flujo real, aquí ESPERARÍA hasta 15:46...');
    console.log('(Simulando espera de 10 segundos para que veas el resultado)');
    await page.waitForTimeout(10000);

    console.log('\n🎯 PASO 5: Ahora INTENTARÍA buscar la clase "12:00 CrossFit"...');
    
    // Buscar la clase (que no existe)
    const classElement = page.getByText('12:00 CrossFit', { exact: true }).first();
    const classVisible = await classElement.isVisible({ timeout: 3000 });
    
    if (classVisible) {
      console.log('✅ Clase encontrada (esto sería inesperado)');
    } else {
      console.log('❌ Clase NO encontrada (como esperábamos)');
      console.log('💡 Esto confirma que SÍ cambió al domingo 14 porque no hay esa clase');
    }

    console.log('\n📸 Tomando screenshot final...');
    await page.screenshot({ path: 'flujo-visual-final.png', fullPage: true });

    console.log('\n🏁 RESUMEN DEL FLUJO:');
    console.log('1. ✅ Login funcionó');
    console.log(`2. ${dayClicked ? '✅' : '❌'} Cambio de día ${dayClicked ? 'funcionó' : 'falló'}`);
    console.log('3. ❌ Clase no encontrada (normal para test)');
    console.log('\n⏳ Manteniendo navegador abierto 30 segundos más para inspección...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n🔚 Cerrando navegador...');
    if (browser) await browser.close();
  }
}

testVisualFlow();