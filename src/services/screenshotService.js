const puppeteer = require('puppeteer');
const { logger } = require('../utils/logger');
const cookieManager = require('../utils/cookieManager');

class ScreenshotService {
  constructor() {
    this.browser = null;
    this.initialized = false;
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

      // Inyectar cookies
      await page.setCookie(
        {
          name: 'sessionid',
          value: cookies.tv_sessionid,
          domain: '.tradingview.com',
          path: '/',
          httpOnly: true,
          secure: true
        },
        {
          name: 'sessionid_sign',
          value: cookies.tv_sessionid_sign,
          domain: '.tradingview.com',
          path: '/',
          httpOnly: true,
          secure: true
        }
      );

      // Construir URL del chart
      const baseUrl = `https://www.tradingview.com/chart/${chartId}/`;
      const chartUrl = ticker ? `${baseUrl}?symbol=${ticker}` : baseUrl;

      logger.debug({ chartUrl }, 'Navegando a chart...');

      // Configurar viewport
      const width = parseInt(process.env.SCREENSHOT_WIDTH) || 1280;
      const height = parseInt(process.env.SCREENSHOT_HEIGHT) || 720;
      await page.setViewport({ width, height });

      // Navegar al chart
      await page.goto(chartUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Esperar a que cargue el chart
      const waitTime = parseInt(process.env.CHART_LOAD_WAIT) || 10000;
      logger.debug({ waitTime }, 'Esperando carga del chart...');
      await page.waitForTimeout(waitTime);

      // Intentar cerrar modales/popups que puedan aparecer
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      } catch (err) {
        // Ignorar si no hay modales
      }

      // Capturar screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false
      });

      logger.info({ size: screenshot.length }, '✅ Screenshot capturado exitosamente');

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

