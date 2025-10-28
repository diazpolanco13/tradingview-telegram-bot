/**
 * Screenshot Worker
 * Procesa jobs de screenshots de forma asíncrona usando BullMQ
 * 
 * NUEVO: Usa TradingView Share (Alt+S) para obtener URLs oficiales
 * En lugar de subir PNGs a Supabase Storage
 */

const { Worker } = require('bullmq');
const { updateScreenshotStatus, supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

// Importar el servicio de screenshots
const screenshotService = require('../services/screenshotService');

// Worker instance (se inicializa externamente)
let workerInstance = null;

/**
 * Iniciar el Worker de screenshots
 * @param {Object} redisConnection - Conexión activa de Redis
 * @returns {Worker} - Worker instance
 */
function startWorker(redisConnection) {
  if (workerInstance) {
    logger.warn('⚠️ Worker ya está corriendo');
    return workerInstance;
  }

  if (!redisConnection) {
    logger.error('❌ No se puede iniciar worker sin conexión Redis');
    return null;
  }

  logger.info('🔄 Inicializando Screenshot Worker...');

  workerInstance = new Worker(
    'screenshot-processing',
    async (job) => {
      const { signalId, userId, ticker, chartId, cookies, resolution } = job.data;

      logger.info(`🔄 Procesando screenshot para señal ${signalId} - ${ticker}`);

      try {
        // 1. Actualizar estado a "processing"
        await updateScreenshotStatus(signalId, 'processing');

        // 2. ✨ MÉTODO PRINCIPAL: TradingView Share (POST directo)
        logger.info('✨ Intentando TradingView Share (POST directo)...');
        
        let shareUrl = null;
        let method = 'tradingview_share';
        
        try {
          shareUrl = await screenshotService.captureWithTradingViewShare(
            ticker,
            chartId,
            cookies
          );

          if (shareUrl) {
            logger.info({ shareUrl }, '✅ TradingView Share URL obtenida');
          }
        } catch (shareError) {
          logger.warn(`⚠️ TradingView Share falló: ${shareError.message}`);
          logger.info('🔄 Intentando fallback: captura manual + Supabase Storage...');
          
          // 🔄 FALLBACK: Captura manual + upload a Supabase Storage
          try {
            const screenshotBuffer = await screenshotService.captureWithUserCookies(
              ticker,
              chartId,
              cookies,
              resolution || '1080p'
            );

            // Upload a Supabase Storage
            const filename = `${signalId}-${Date.now()}.png`;
            const { data: uploadData, error: uploadError } = await supabase
              .storage
              .from('trading-screenshots')
              .upload(`${userId}/${filename}`, screenshotBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              throw new Error(`Error subiendo a Storage: ${uploadError.message}`);
            }

            // Obtener URL pública
            const { data: { publicUrl } } = supabase
              .storage
              .from('trading-screenshots')
              .getPublicUrl(`${userId}/${filename}`);

            shareUrl = publicUrl;
            method = 'supabase_storage_fallback';
            
            logger.info({ shareUrl }, '✅ Screenshot subido a Supabase Storage (fallback)');
          } catch (fallbackError) {
            logger.error(`❌ Fallback también falló: ${fallbackError.message}`);
            throw new Error(`Ambos métodos fallaron: Share=${shareError.message}, Fallback=${fallbackError.message}`);
          }
        }

        if (!shareUrl) {
          throw new Error('No se pudo obtener URL del screenshot (ambos métodos fallaron)');
        }

        // 3. Guardar URL en Supabase
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

        logger.info(`✅ Screenshot completado: ${signalId} - Método: ${method}`);

        return {
          success: true,
          signalId,
          screenshotUrl: shareUrl,
          method
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
  workerInstance.on('completed', (job) => {
    logger.info(`✅ Worker completó job: ${job.id}`);
  });

  workerInstance.on('failed', (job, error) => {
    logger.error(`❌ Worker falló job: ${job?.id} - ${error.message}`);
  });

  workerInstance.on('error', (error) => {
    logger.error('❌ Error en el worker:', error.message);
  });

  workerInstance.on('stalled', (jobId) => {
    logger.warn(`⚠️ Job estancado detectado: ${jobId}`);
  });

  logger.info('✅ Screenshot Worker inicializado correctamente');
  
  return workerInstance;
}

/**
 * Graceful shutdown del worker
 */
async function stopWorker() {
  if (!workerInstance) return;
  
  try {
    await workerInstance.close();
    workerInstance = null;
    logger.info('🛑 Screenshot worker cerrado correctamente');
  } catch (error) {
    logger.error('❌ Error cerrando worker:', error.message);
  }
}

module.exports = {
  startWorker,
  stopWorker,
  getWorkerInstance: () => workerInstance
};
