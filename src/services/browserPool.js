/**
 * Hot Chart Pool - Browser Pool Manager
 * 
 * Mantiene un pool de navegadores Puppeteer abiertos y listos para capturar screenshots.
 * Reduce el tiempo de captura de ~20s a ~6-8s al reutilizar browsers.
 * 
 * Features:
 * - Pool mínimo/máximo configurable
 * - Cleanup automático de browsers inactivos
 * - Aislamiento de cookies entre usuarios
 * - Auto-scaling según demanda
 * - Health monitoring
 */

const puppeteer = require('puppeteer');
const { logger } = require('../utils/logger');

class HotChartPool {
  constructor(config = {}) {
    this.config = {
      minBrowsers: config.minBrowsers || 2,
      maxBrowsers: config.maxBrowsers || 5,
      idleTimeout: config.idleTimeout || 30 * 60 * 1000, // 30 minutos
      cleanupInterval: config.cleanupInterval || 10 * 60 * 1000, // 10 minutos
      warmup: config.warmup !== undefined ? config.warmup : true
    };

    this.pool = [];
    this.initialized = false;
    this.cleanupTimer = null;
    this.stats = {
      totalCreated: 0,
      totalClosed: 0,
      totalCaptures: 0,
      activeCaptures: 0
    };
  }

  /**
   * Inicializar el pool con browsers mínimos
   */
  async init() {
    if (this.initialized) {
      logger.warn('⚠️ Pool ya está inicializado');
      return;
    }

    logger.info({ 
      minBrowsers: this.config.minBrowsers,
      maxBrowsers: this.config.maxBrowsers 
    }, '🔥 Inicializando Hot Chart Pool...');

    try {
      // Crear browsers iniciales
      for (let i = 0; i < this.config.minBrowsers; i++) {
        await this.createBrowser();
      }

      // Iniciar cleanup automático
      this.startCleanup();

      this.initialized = true;
      logger.info({ poolSize: this.pool.length }, '✅ Hot Chart Pool inicializado correctamente');

    } catch (error) {
      logger.error({ error: error.message }, '❌ Error inicializando pool');
      throw error;
    }
  }

  /**
   * Crear un nuevo browser y agregarlo al pool
   */
  async createBrowser() {
    try {
      logger.debug('🌐 Creando nuevo browser...');

      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Warmup opcional: pre-cargar TradingView
      if (this.config.warmup) {
        logger.debug('🔥 Warmup: pre-cargando TradingView...');
        await page.goto('https://www.tradingview.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
      }

      const slot = {
        id: `browser-${this.stats.totalCreated}`,
        browser,
        page,
        inUse: false,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        captureCount: 0
      };

      this.pool.push(slot);
      this.stats.totalCreated++;

      logger.info({ 
        browserId: slot.id,
        poolSize: this.pool.length 
      }, '✅ Browser creado y agregado al pool');

      return slot;

    } catch (error) {
      logger.error({ error: error.message }, '❌ Error creando browser');
      throw error;
    }
  }

  /**
   * Obtener un browser disponible del pool
   */
  async acquireBrowser() {
    // Buscar browser libre
    let slot = this.pool.find(s => !s.inUse);

    // Si no hay disponible y no alcanzamos el máximo, crear uno nuevo
    if (!slot && this.pool.length < this.config.maxBrowsers) {
      logger.info('📈 Pool lleno - creando browser adicional...');
      slot = await this.createBrowser();
    }

    // Si aún no hay, esperar a que se libere uno
    if (!slot) {
      logger.warn('⏳ Pool saturado - esperando browser disponible...');
      await this.waitForAvailableBrowser();
      return this.acquireBrowser(); // Recursión
    }

    // Marcar como en uso
    slot.inUse = true;
    slot.lastUsed = Date.now();
    this.stats.activeCaptures++;

    logger.debug({ browserId: slot.id }, '🔒 Browser adquirido del pool');

    return slot;
  }

  /**
   * Liberar un browser de vuelta al pool
   */
  async releaseBrowser(slot) {
    try {
      // Limpiar cookies para próximo usuario
      const cookies = await slot.page.cookies();
      if (cookies.length > 0) {
        await slot.page.deleteCookie(...cookies);
      }

      // Marcar como disponible
      slot.inUse = false;
      slot.lastUsed = Date.now();
      slot.captureCount++;
      this.stats.activeCaptures--;
      this.stats.totalCaptures++;

      logger.debug({ 
        browserId: slot.id,
        captureCount: slot.captureCount 
      }, '🔓 Browser liberado al pool');

    } catch (error) {
      logger.error({ 
        browserId: slot.id,
        error: error.message 
      }, '⚠️ Error liberando browser - será destruido');
      
      // Si falla, removerlo del pool
      await this.destroyBrowser(slot);
    }
  }

  /**
   * Destruir un browser específico
   */
  async destroyBrowser(slot) {
    try {
      await slot.browser.close();
      this.pool = this.pool.filter(s => s.id !== slot.id);
      this.stats.totalClosed++;

      logger.info({ browserId: slot.id }, '🗑️ Browser destruido');

    } catch (error) {
      logger.error({ error: error.message }, '❌ Error cerrando browser');
    }
  }

  /**
   * Esperar a que haya un browser disponible
   */
  async waitForAvailableBrowser() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const available = this.pool.find(s => !s.inUse);
        if (available) {
          clearInterval(interval);
          resolve();
        }
      }, 500); // Check cada 500ms
    });
  }

  /**
   * Cleanup automático de browsers inactivos
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    logger.info({ 
      interval: this.config.cleanupInterval / 1000 
    }, '🧹 Cleanup automático iniciado');
  }

  /**
   * Ejecutar cleanup de browsers
   */
  async performCleanup() {
    const now = Date.now();
    const threshold = this.config.idleTimeout;

    logger.debug('🧹 Ejecutando cleanup del pool...');

    for (const slot of this.pool) {
      // No cerrar si está en uso
      if (slot.inUse) continue;

      // No cerrar si no alcanzamos el mínimo
      if (this.pool.length <= this.config.minBrowsers) continue;

      // Cerrar si está inactivo por mucho tiempo
      const idleTime = now - slot.lastUsed;
      if (idleTime > threshold) {
        logger.info({ 
          browserId: slot.id,
          idleMinutes: Math.floor(idleTime / 1000 / 60)
        }, '🗑️ Cerrando browser inactivo');
        
        await this.destroyBrowser(slot);
      }
    }

    // Asegurar que siempre tengamos el mínimo
    while (this.pool.length < this.config.minBrowsers) {
      await this.createBrowser();
    }

    logger.debug({ 
      poolSize: this.pool.length,
      activeCaptures: this.stats.activeCaptures 
    }, '✅ Cleanup completado');
  }

  /**
   * Obtener estadísticas del pool
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      inUse: this.pool.filter(s => s.inUse).length,
      available: this.pool.filter(s => !s.inUse).length,
      config: this.config,
      stats: this.stats,
      browsers: this.pool.map(s => ({
        id: s.id,
        inUse: s.inUse,
        captureCount: s.captureCount,
        ageMinutes: Math.floor((Date.now() - s.createdAt) / 1000 / 60),
        idleMinutes: Math.floor((Date.now() - s.lastUsed) / 1000 / 60)
      }))
    };
  }

  /**
   * Cerrar todo el pool (para shutdown)
   */
  async shutdown() {
    logger.info('🛑 Cerrando Hot Chart Pool...');

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    const closingPromises = this.pool.map(slot => slot.browser.close());
    await Promise.all(closingPromises);

    this.pool = [];
    this.initialized = false;

    logger.info('✅ Hot Chart Pool cerrado correctamente');
  }
}

// Instancia singleton
let poolInstance = null;

/**
 * Obtener o crear instancia del pool
 */
function getPool() {
  if (!poolInstance) {
    const config = {
      minBrowsers: parseInt(process.env.POOL_MIN_BROWSERS) || 2,
      maxBrowsers: parseInt(process.env.POOL_MAX_BROWSERS) || 5,
      idleTimeout: parseInt(process.env.POOL_IDLE_TIMEOUT) || 30 * 60 * 1000,
      warmup: process.env.POOL_WARMUP !== 'false'
    };

    poolInstance = new HotChartPool(config);
  }

  return poolInstance;
}

module.exports = {
  HotChartPool,
  getPool
};

