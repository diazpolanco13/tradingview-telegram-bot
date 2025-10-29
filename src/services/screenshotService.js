const puppeteer = require('puppeteer');
const { logger } = require('../utils/logger');
const CookieManager = require('../utils/cookieManager');
const { getPool } = require('./browserPool');

// Instancia de cookieManager
const cookieManager = new CookieManager();

class ScreenshotService {
  constructor() {
    this.browser = null;
    this.initialized = false;
    this.usePool = process.env.USE_BROWSER_POOL !== 'false'; // Default: true
  }

  /**
   * Inicializar navegador Puppeteer
   */
  async init() {
    if (this.initialized) return;

    try {
      logger.info('🚀 Inicializando Puppeteer...');

      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.initialized = true;
      logger.info('✅ Puppeteer inicializado correctamente');
    } catch (error) {
      logger.error({ error: error.message }, '❌ Error inicializando Puppeteer');
      throw error;
    }
  }

  /**
   * Capturar screenshot de un chart de TradingView
   * @param {string} chartId - ID del chart de TradingView
   * @param {string} ticker - Ticker opcional (ej: BTCUSDT)
   * @returns {Promise<Buffer>} Screenshot como buffer
   */
  async captureChart(chartId, ticker = null) {
    if (!this.browser) {
      await this.init();
    }

    const page = await this.browser.newPage();

    try {
      logger.info({ chartId, ticker }, '📸 Capturando screenshot...');

      // Cargar cookies de TradingView
      const cookies = await cookieManager.loadCookies();
      
      if (!cookies) {
        throw new Error('No hay cookies de TradingView configuradas. Configura en el panel admin.');
      }

      // Inyectar cookies (compatibilidad con ambos formatos)
      const sessionid = cookies.sessionid || cookies.tv_sessionid;
      const sessionid_sign = cookies.sessionid_sign || cookies.tv_sessionid_sign;

      if (!sessionid || !sessionid_sign) {
        throw new Error('Cookies inválidas. Verifica que estén configuradas correctamente.');
      }

      await page.setCookie(
        {
          name: 'sessionid',
          value: sessionid,
          domain: '.tradingview.com',
          path: '/',
          httpOnly: true,
          secure: true
        },
        {
          name: 'sessionid_sign',
          value: sessionid_sign,
          domain: '.tradingview.com',
          path: '/',
          httpOnly: true,
          secure: true
        }
      );

      // Construir URL del chart
      const baseUrl = `https://www.tradingview.com/chart/${chartId}/`;
      
      // Si hay ticker, agregarlo a la URL con formato correcto
      let chartUrl = baseUrl;
      if (ticker) {
        // Si el ticker NO tiene exchange (ej: "BTCUSDT"), no agregar symbol
        // TradingView usará el símbolo guardado en el chart
        // Si tiene exchange (ej: "BINANCE:BTCUSDT"), agregarlo
        if (ticker.includes(':')) {
          chartUrl = `${baseUrl}?symbol=${ticker}`;
        } else {
          // Ticker sin exchange, dejar que TradingView use el del chart
          logger.info({ ticker }, 'Ticker sin exchange, usando símbolo guardado en chart');
        }
      }

      logger.debug({ chartUrl, ticker }, 'Navegando a chart...');

      // Configurar viewport rectangular (16:9 ratio)
      const width = parseInt(process.env.SCREENSHOT_WIDTH) || 1920;  // Full HD por defecto
      const height = parseInt(process.env.SCREENSHOT_HEIGHT) || 1080; // 16:9 ratio
      await page.setViewport({ 
        width, 
        height,
        deviceScaleFactor: 1 // Sin escalado adicional
      });

      // Navegar al chart (timeout aumentado)
      await page.goto(chartUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000 // Aumentado a 60s para charts complejos
      });

      // Esperar a que cargue el chart
      const waitTime = parseInt(process.env.CHART_LOAD_WAIT) || 8000; // Optimizado a 8s
      logger.debug({ waitTime }, 'Esperando carga del chart...');
      await page.waitForTimeout(waitTime);

      // Intentar cerrar modales/popups que puedan aparecer
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      } catch (err) {
        // Ignorar si no hay modales
      }

      // Capturar screenshot del viewport completo (rectangular 16:9)
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false, // Captura solo viewport visible
        clip: undefined  // Sin recorte, toma el viewport completo
      });

      logger.info({ 
        size: screenshot.length,
        dimensions: `${width}x${height}`
      }, '✅ Screenshot rectangular capturado exitosamente');

      return screenshot;

    } catch (error) {
      logger.error({ 
        error: error.message, 
        chartId, 
        ticker 
      }, '❌ Error capturando screenshot');
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Capturar screenshot con cookies específicas del usuario
   * NUEVO: Para sistema multi-tenant
   * @param {string} ticker - Ticker (símbolo)
   * @param {string} chartId - ID del chart
   * @param {Object} userCookies - Cookies del usuario {sessionid, sessionid_sign}
   * @param {string} resolution - Resolución (720p, 1080p, 4k)
   * @returns {Promise<Buffer>} Screenshot como buffer
   */
  async captureWithUserCookies(ticker, chartId, userCookies, resolution = '1080p') {
    if (!this.browser) {
      await this.init();
    }

    const page = await this.browser.newPage();

    try {
      logger.info({ ticker, chartId, resolution }, '📸 Capturando screenshot con cookies de usuario...');

      // Validar cookies
      if (!userCookies || !userCookies.sessionid || !userCookies.sessionid_sign) {
        throw new Error('Cookies de usuario inválidas o no configuradas');
      }

      // Inyectar cookies del usuario
      await page.setCookie(
        {
          name: 'sessionid',
          value: userCookies.sessionid,
          domain: '.tradingview.com',
          path: '/',
          httpOnly: true,
          secure: true
        },
        {
          name: 'sessionid_sign',
          value: userCookies.sessionid_sign,
          domain: '.tradingview.com',
          path: '/',
          httpOnly: true,
          secure: true
        }
      );

      // Construir URL del chart
      const baseUrl = `https://www.tradingview.com/chart/${chartId}/`;
      let chartUrl = baseUrl;
      
      if (ticker && ticker.includes(':')) {
        chartUrl = `${baseUrl}?symbol=${ticker}`;
      }

      logger.debug({ chartUrl }, 'Navegando a chart...');

      // Configurar viewport según resolución (16:9 ratio para todos)
      const viewportConfig = {
        '720p': { width: 1280, height: 720 },   // 16:9 HD
        '1080p': { width: 1920, height: 1080 }, // 16:9 Full HD
        '4k': { width: 3840, height: 2160 }     // 16:9 4K
      };

      const { width, height } = viewportConfig[resolution] || viewportConfig['1080p'];
      await page.setViewport({ 
        width, 
        height,
        deviceScaleFactor: 1 // Sin escalado adicional
      });

      // Navegar al chart (timeout aumentado)
      await page.goto(chartUrl, {
        waitUntil: 'networkidle2',
        timeout: parseInt(process.env.SCREENSHOT_TIMEOUT) || 60000 // Aumentado a 60s
      });

      // Esperar carga del chart
      const waitTime = parseInt(process.env.CHART_LOAD_WAIT) || 8000; // Optimizado a 8s
      await page.waitForTimeout(waitTime);

      // Cerrar modales si existen
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      } catch (err) {
        // Ignorar
      }

      // Capturar screenshot del viewport completo (rectangular 16:9)
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false, // Captura solo viewport visible
        clip: undefined  // Sin recorte, toma el viewport completo
      });

      logger.info({ 
        size: screenshot.length, 
        resolution,
        dimensions: `${width}x${height}`
      }, '✅ Screenshot rectangular capturado exitosamente');

      return screenshot;

    } catch (error) {
      logger.error({ 
        error: error.message, 
        ticker, 
        chartId 
      }, '❌ Error capturando screenshot con cookies de usuario');
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Capturar screenshot y subirlo a TradingView vía POST directo
   * NUEVO MÉTODO: Replica el POST interno de TradingView (más confiable que Alt+S)
   * USA POOL DE BROWSERS para reducir tiempo de ~20s a ~6-8s
   * @param {string} ticker - Símbolo del activo
   * @param {string} chartId - ID del chart de TradingView
   * @param {object} userCookies - Cookies del usuario { sessionid, sessionid_sign }
   * @returns {Promise<string>} - URL del screenshot compartido por TradingView
   */
  async captureWithTradingViewShare(ticker, chartId, userCookies) {
    const fetch = require('node-fetch');
    const FormData = require('form-data');
    
    // Usar pool si está habilitado, sino método tradicional
    const usingPool = this.usePool && process.env.NODE_ENV === 'production';
    let browserSlot = null;
    let page = null;

    try {
      if (usingPool) {
        // MÉTODO CON POOL (rápido)
        logger.info('🔥 Usando Hot Chart Pool...');
        const pool = getPool();
        
        if (!pool.initialized) {
          await pool.init();
        }
        
        browserSlot = await pool.acquireBrowser();
        page = browserSlot.page;
        
      } else {
        // MÉTODO TRADICIONAL (fallback)
        logger.info('🐌 Usando método tradicional (sin pool)...');
        if (!this.browser) {
          await this.init();
        }
        page = await this.browser.newPage();
      }

    try {
      logger.info({ ticker, chartId }, '📸 Capturando screenshot con POST directo a TradingView');

      // Validar cookies
      const { sessionid, sessionid_sign } = userCookies;
      if (!sessionid || !sessionid_sign) {
        throw new Error('Cookies de usuario inválidas o no configuradas');
      }

      // Inyectar cookies del usuario
      await page.setCookie(
        {
          name: 'sessionid',
          value: sessionid,
          domain: '.tradingview.com',
          path: '/',
          httpOnly: true,
          secure: true
        },
        {
          name: 'sessionid_sign',
          value: sessionid_sign,
          domain: '.tradingview.com',
          path: '/',
          httpOnly: true,
          secure: true
        }
      );

      // Construir URL del chart
      const baseUrl = `https://www.tradingview.com/chart/${chartId}/`;
      let chartUrl = baseUrl;
      if (ticker && ticker.includes(':')) {
        chartUrl = `${baseUrl}?symbol=${ticker}`;
      }

      logger.info({ chartUrl }, '🌐 Navegando al chart del usuario...');

      // Configurar viewport panorámico (16:9 para charts de trading)
      // Dimensiones ajustadas para captura rectangular completa
      const width = 1920;  // Full HD width
      const height = 1080; // Full HD height (16:9 ratio)
      await page.setViewport({ 
        width, 
        height,
        deviceScaleFactor: 1 // Sin escalado adicional
      });

      // Navegar al chart (timeout aumentado para charts complejos)
      await page.goto(chartUrl, {
        waitUntil: 'networkidle2',
        timeout: parseInt(process.env.SCREENSHOT_TIMEOUT) || 60000 // Aumentado a 60s
      });

      // 🚫 BLOQUEAR POPUPS DE UPGRADE/PAYWALL CON CSS
      try {
        await page.addStyleTag({
          content: `
            /* Ocultar popups de upgrade y paywalls */
            div[data-name="upgrade-dialog"],
            div[data-name="go-to-pro-dialog"],
            div[class*="upgrade"],
            div[class*="paywall"],
            div[class*="subscription"],
            .tv-dialog--popup,
            .tv-dialog__modal-wrap,
            [data-role="dialog"],
            div[data-outside-boundary-for="upgrade-dialog"] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
            }
          `
        });
        logger.debug('🚫 CSS anti-popup inyectado');
      } catch (cssError) {
        logger.warn('⚠️ No se pudo inyectar CSS anti-popup (continuando...)');
      }

      // Esperar a que cargue completamente el chart
      const waitTime = parseInt(process.env.CHART_LOAD_WAIT) || 8000; // Optimizado a 8s
      logger.info({ waitTime }, '⏳ Esperando carga completa del chart...');
      await page.waitForTimeout(waitTime);

      // Cerrar modales que puedan interferir
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      } catch (err) {
        // Ignorar
      }

      // 📸 CAPTURAR SCREENSHOT COMPLETO (viewport completo en 16:9)
      logger.info('📸 Capturando PNG del chart completo...');
      
      // Capturar screenshot del viewport completo (respeta el 1920x1080 configurado)
      // fullPage: false garantiza que capture exactamente el viewport (rectangular)
      const screenshotBuffer = await page.screenshot({ 
        type: 'png', 
        fullPage: false, // Captura solo viewport visible
        clip: undefined  // Sin recorte, toma el viewport completo
      });

      logger.info({ 
        bufferSize: screenshotBuffer.length,
        dimensions: `${width}x${height}` 
      }, '✅ PNG rectangular generado localmente');

      // 🚀 POST DIRECTO A TRADINGVIEW /snapshot/
      logger.info('🚀 POSTando imagen a TradingView /snapshot/...');

      const form = new FormData();
      form.append('preparedImage', screenshotBuffer, {
        filename: 'snapshot.png',
        contentType: 'image/png'
      });

      // Construir cookie string para el header
      const cookieString = `sessionid=${sessionid}; sessionid_sign=${sessionid_sign}`;

      const response = await fetch('https://www.tradingview.com/snapshot/', {
        method: 'POST',
        body: form,
        headers: {
          ...form.getHeaders(),
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
          'Referer': chartUrl,
          'Accept': '*/*',
          'Origin': 'https://www.tradingview.com',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ 
          status: response.status, 
          statusText: response.statusText,
          error: errorText
        }, '❌ Error en POST a /snapshot/');
        throw new Error(`TradingView POST falló: ${response.status} ${response.statusText}`);
      }

      // La respuesta es la URL o ID en texto plano
      const shareResponse = await response.text();
      const cleanResponse = shareResponse.trim();

      logger.info({ shareUrl: cleanResponse }, '✅ URL de TradingView obtenida exitosamente');

      // Construir URL completa si solo devuelve el ID
      let finalUrl = cleanResponse;
      
      if (!cleanResponse.startsWith('http')) {
        // TradingView devolvió solo el ID (ej: "7vRdVsyc")
        // Construir URL completa
        finalUrl = `https://www.tradingview.com/x/${cleanResponse}/`;
        logger.info({ originalResponse: cleanResponse, finalUrl }, '🔧 URL construida desde ID');
      } else if (!cleanResponse.endsWith('/')) {
        // Asegurar que termine con /
        finalUrl = `${cleanResponse}/`;
      }

      // Validar que la URL sea válida
      if (!finalUrl.includes('tradingview.com/x/')) {
        throw new Error(`URL inválida recibida de TradingView: ${cleanResponse}`);
      }

      return finalUrl;

    } catch (error) {
      logger.error({ 
        error: error.message, 
        ticker, 
        chartId 
      }, '❌ Error capturando screenshot con POST directo');
      
      // Re-lanzar el error para que el worker pueda manejarlo
      throw error;
      
    } finally {
      // Liberar browser según el método usado
      if (usingPool && browserSlot) {
        const pool = getPool();
        await pool.releaseBrowser(browserSlot);
        logger.debug('🔓 Browser liberado al pool');
      } else if (!usingPool && page && typeof page.close === 'function') {
        await page.close();
        logger.debug('🔒 Página cerrada (modo sin pool)');
      }
    }
  } catch (outerError) {
    // Error general
    logger.error({ error: outerError.message }, '❌ Error general en captura');
    throw outerError;
  }
}

  /**
   * Cerrar navegador
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.initialized = false;
      logger.info('🔒 Puppeteer cerrado');
    }
  }
}

module.exports = new ScreenshotService();

