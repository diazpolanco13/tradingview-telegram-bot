/**
 * Screenshot Worker
 * Procesa jobs de screenshots de forma asíncrona usando BullMQ
 * 
 * NUEVO: Usa TradingView Share (Alt+S) para obtener URLs oficiales
 * En lugar de subir PNGs a Supabase Storage
 */

const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { updateScreenshotStatus, supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

// Importar el servicio de screenshots
const screenshotService = require('../services/screenshotService');

/**
 * Worker que procesa screenshots
 */
const screenshotWorker = new Worker(
  'screenshot-processing',
  async (job) => {
    const { signalId, userId, ticker, chartId, cookies, resolution } = job.data;

    logger.info(`🔄 Procesando screenshot para señal ${signalId} - ${ticker}`);

    try {
      // 1. Actualizar estado a "processing"
      await updateScreenshotStatus(signalId, 'processing');

      // 2. ✨ NUEVO: Capturar usando TradingView Share (Alt + S)
      logger.info('✨ Usando TradingView Share para capturar screenshot...');
      
      const shareUrl = await screenshotService.captureWithTradingViewShare(
        ticker,
        chartId,
        cookies
      );

      if (!shareUrl) {
        throw new Error('No se pudo capturar la share URL de TradingView');
      }

      logger.info({ shareUrl }, '✅ TradingView Share URL obtenida');

      // 3. Guardar URL directamente en Supabase (sin upload de imagen)
      const { data, error } = await supabase
        .from('trading_signals')
        .update({ 
          screenshot_url: shareUrl,
          screenshot_status: 'completed'
        })
        .eq('id', signalId)
        .select()
        .single();

      if (error) {
        throw new Error(`Error actualizando señal: ${error.message}`);
      }

      logger.info(`✅ Screenshot completado: ${signalId} - ${shareUrl}`);

      return {
        success: true,
        signalId,
        screenshotUrl: shareUrl,
        method: 'tradingview_share'
      };
    } catch (error) {
      logger.error(`❌ Error procesando screenshot ${signalId}:`, error.message);

      // Actualizar estado a "failed"
      await updateScreenshotStatus(signalId, 'failed');

      throw error; // BullMQ reintentará según configuración
    }
  },
  {
    connection: redisConnection,
    concurrency: 2, // Procesar 2 screenshots simultáneamente
    limiter: {
      max: 10, // Máximo 10 jobs
      duration: 60000 // Por minuto
    }
  }
);

/**
 * Eventos del worker
 */
screenshotWorker.on('completed', (job) => {
  logger.info(`✅ Worker completó job: ${job.id}`);
});

screenshotWorker.on('failed', (job, error) => {
  logger.error(`❌ Worker falló job: ${job?.id} - ${error.message}`);
});

screenshotWorker.on('error', (error) => {
  logger.error('❌ Error en el worker:', error.message);
});

screenshotWorker.on('stalled', (jobId) => {
  logger.warn(`⚠️ Job estancado detectado: ${jobId}`);
});

/**
 * Graceful shutdown
 */
async function shutdownWorker() {
  try {
    await screenshotWorker.close();
    logger.info('🛑 Screenshot worker cerrado correctamente');
  } catch (error) {
    logger.error('❌ Error cerrando worker:', error.message);
  }
}

process.on('SIGTERM', shutdownWorker);
process.on('SIGINT', shutdownWorker);

module.exports = {
  screenshotWorker,
  shutdownWorker
};

