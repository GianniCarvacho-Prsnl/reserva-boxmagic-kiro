import { launchChromium } from 'playwright-aws-lambda';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const SELECTORS = {
  login: {
    email: 'input[placeholder="Correo"]',
    password: 'input[placeholder="Contraseña"]', 
    submitButton: 'button[type="submit"]'
  },
  navigation: {
    todayButton: '.Ui2Boton:has-text("Hoy")',
    tomorrowButton: '.Ui2Boton:has-text("Mañana")'
  }
};

async function testDaySelection() {
  let browser, context, page;

  try {
    console.log('🚀 Iniciando test de selección de día...');
    
    // Configurar navegador (sin headless para ver lo que pasa)
    browser = await launchChromium({
      headless: false, // Cambiar a true si quieres que sea invisible
      channel: 'chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-automation'
      ]
    });

    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'es-CL',
      timezoneId: 'America/Santiago'
    });

    page = await context.newPage();
    page.setDefaultTimeout(30000);

    // Paso 1: Login
    console.log('🔐 Haciendo login...');
    await page.goto('https://members.boxmagic.app/acceso/ingreso');
    await page.waitForTimeout(5000);

    // Verificar si ya estamos logueados
    if (page.url().includes('/horarios')) {
      console.log('✅ Ya estamos logueados');
    } else {
      await page.getByRole('textbox', { name: 'Correo' }).fill(process.env.BOXMAGIC_EMAIL);
      await page.getByRole('textbox', { name: 'Contraseña' }).fill(process.env.BOXMAGIC_PASSWORD);
      await page.locator('button[type="submit"]').click();
      
      await page.waitForFunction(() => {
        return window.location.pathname.includes('/horarios');
      }, { timeout: 15000 });
      console.log('✅ Login completado');
    }

    // Manejar popups
    await page.waitForTimeout(3000);
    try {
      const popup = page.locator('dialog.zonaModal').first();
      if (await popup.isVisible({ timeout: 2000 })) {
        const closeButton = page.locator('dialog.zonaModal .elModal-nucleo-cerrador').first();
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click();
          console.log('✅ Popup cerrado');
        }
      }
    } catch (e) {
      console.log('ℹ️  No se encontraron popups');
    }

    // Paso 2: Verificar estado inicial
    console.log('📅 Verificando estado inicial de los botones de día...');
    
    const todayButton = page.locator(SELECTORS.navigation.todayButton).first();
    const tomorrowButton = page.locator(SELECTORS.navigation.tomorrowButton).first();
    
    const todayVisible = await todayButton.isVisible({ timeout: 3000 });
    const tomorrowVisible = await tomorrowButton.isVisible({ timeout: 3000 });
    
    console.log(`📍 Botón "Hoy" visible: ${todayVisible}`);
    console.log(`📍 Botón "Mañana" visible: ${tomorrowVisible}`);
    
    if (todayVisible) {
      const todayClass = await todayButton.getAttribute('class');
      console.log(`📍 Clases del botón "Hoy": ${todayClass}`);
    }
    
    if (tomorrowVisible) {
      const tomorrowClass = await tomorrowButton.getAttribute('class');
      console.log(`📍 Clases del botón "Mañana": ${tomorrowClass}`);
    }

    // Paso 3: Tomar screenshot antes del click
    await page.screenshot({ path: 'before-tomorrow-click.png', fullPage: true });
    console.log('📸 Screenshot tomado: before-tomorrow-click.png');

    // Paso 4: Hacer click en "Mañana"
    if (tomorrowVisible) {
      console.log('🎯 Haciendo click en botón "Mañana"...');
      await tomorrowButton.click({ force: true });
      console.log('✅ Click en "Mañana" ejecutado');
      
      // Esperar a que se procese
      await page.waitForTimeout(2000);
      
      // Verificar estado después del click
      const tomorrowClassAfter = await tomorrowButton.getAttribute('class');
      console.log(`📍 Clases del botón "Mañana" después del click: ${tomorrowClassAfter}`);
      
      // Tomar screenshot después del click
      await page.screenshot({ path: 'after-tomorrow-click.png', fullPage: true });
      console.log('📸 Screenshot tomado: after-tomorrow-click.png');
      
      // Verificar URL y contenido de la página
      console.log(`📍 URL actual: ${page.url()}`);
      
      // Buscar indicadores de fecha en la página
      const dateIndicators = await page.locator('text=/\\d{1,2}/', { hasText: /1[4-9]|2[0-9]/ }).count();
      console.log(`📍 Indicadores de fecha encontrados: ${dateIndicators}`);
      
      // Listar algunas clases visibles para debug
      console.log('📋 Listando clases visibles:');
      const classElements = page.locator('h3, h4, [role="heading"]');
      const classCount = await classElements.count();
      console.log(`📍 Total de elementos de clase encontrados: ${classCount}`);
      
      for (let i = 0; i < Math.min(classCount, 5); i++) {
        const classText = await classElements.nth(i).textContent();
        console.log(`  ${i + 1}. ${classText}`);
      }
      
    } else {
      console.log('❌ Botón "Mañana" no visible, no se puede hacer click');
    }

    // Mantener el navegador abierto por un momento para inspección visual
    console.log('⏳ Manteniendo navegador abierto por 10 segundos para inspección...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ Error durante el test:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('🏁 Test completado');
  }
}

// Ejecutar test
testDaySelection();