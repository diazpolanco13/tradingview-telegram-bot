/**
 * Screenshot Worker
 * Procesa jobs de screenshots de forma asíncrona usando BullMQ
 */

const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { updateScreenshotStatus, uploadScreenshot } = require('../config/supabase');
const { logger } = require('../utils/logger');

// Importar el servicio de screenshots (lo adaptaremos después)
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

      // 2. Capturar screenshot con cookies del usuario
      const screenshotBuffer = await screenshotService.captureWithUserCookies(
        ticker,
        chartId,
        cookies,
        resolution
      );

      if (!screenshotBuffer) {
        throw new Error('No se pudo capturar el screenshot');
      }

      // 3. Subir a Supabase Storage
      const filename = `${ticker}_${Date.now()}.png`;
      const screenshotUrl = await uploadScreenshot(screenshotBuffer, userId, filename);

      if (!screenshotUrl) {
        throw new Error('No se pudo subir el screenshot');
      }

      // 4. Actualizar estado a "completed" con URL
      await updateScreenshotStatus(signalId, 'completed', screenshotUrl);

      logger.info(`✅ Screenshot completado: ${signalId} - ${screenshotUrl}`);

      return {
        success: true,
        signalId,
        screenshotUrl
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

