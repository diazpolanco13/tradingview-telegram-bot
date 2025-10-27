/**
 * Screenshot Queue with BullMQ
 * Cola asíncrona para procesar capturas de pantalla de TradingView
 */

const { Queue, Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { logger } = require('../utils/logger');

/**
 * Cola de screenshots
 */
const screenshotQueue = new Queue('screenshot-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // 3 intentos máximo
    backoff: {
      type: 'exponential',
      delay: 5000 // 5 segundos base
    },
    removeOnComplete: {
      age: 3600, // Mantener completados 1 hora
      count: 100 // Máximo 100 jobs completados
    },
    removeOnFail: {
      age: 86400 // Mantener fallidos 24 horas
    }
  }
});

/**
 * Agregar un job de screenshot a la cola
 * @param {Object} jobData - Datos del job
 * @param {string} jobData.signalId - ID de la señal
 * @param {string} jobData.userId - ID del usuario
 * @param {string} jobData.ticker - Ticker (símbolo)
 * @param {string} jobData.chartId - ID del chart de TradingView
 * @param {Object} jobData.cookies - Cookies desencriptadas
 * @param {string} jobData.resolution - Resolución del screenshot
 * @returns {Promise<Job>}
 */
async function addScreenshotJob(jobData) {
  try {
    const job = await screenshotQueue.add(
      'capture-screenshot',
      jobData,
      {
        jobId: jobData.signalId, // Usar signalId como jobId único
        priority: 1 // Prioridad normal
      }
    );

    logger.info(`📸 Job de screenshot encolado: ${job.id}`);
    return job;
  } catch (error) {
    logger.error('❌ Error encolando screenshot:', error.message);
    throw error;
  }
}

/**
 * Obtener estadísticas de la cola
 */
async function getQueueStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      screenshotQueue.getWaitingCount(),
      screenshotQueue.getActiveCount(),
      screenshotQueue.getCompletedCount(),
      screenshotQueue.getFailedCount(),
      screenshotQueue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  } catch (error) {
    logger.error('❌ Error obteniendo estadísticas de cola:', error.message);
    return null;
  }
}

/**
 * Limpiar jobs completados y fallidos
 */
async function cleanQueue() {
  try {
    await screenshotQueue.clean(3600000, 100, 'completed'); // 1 hora
    await screenshotQueue.clean(86400000, 50, 'failed'); // 24 horas
    logger.info('🧹 Cola limpiada correctamente');
  } catch (error) {
    logger.error('❌ Error limpiando cola:', error.message);
  }
}

/**
 * Pausar la cola
 */
async function pauseQueue() {
  try {
    await screenshotQueue.pause();
    logger.info('⏸️ Cola pausada');
  } catch (error) {
    logger.error('❌ Error pausando cola:', error.message);
  }
}

/**
 * Reanudar la cola
 */
async function resumeQueue() {
  try {
    await screenshotQueue.resume();
    logger.info('▶️ Cola reanudada');
  } catch (error) {
    logger.error('❌ Error reanudando cola:', error.message);
  }
}

/**
 * Eventos de la cola
 */
screenshotQueue.on('error', (error) => {
  logger.error('❌ Error en la cola de screenshots:', error.message);
});

screenshotQueue.on('waiting', (job) => {
  logger.info(`⏳ Job esperando: ${job.id}`);
});

screenshotQueue.on('active', (job) => {
  logger.info(`🔄 Job procesándose: ${job.id}`);
});

screenshotQueue.on('completed', (job) => {
  logger.info(`✅ Job completado: ${job.id}`);
});

screenshotQueue.on('failed', (job, error) => {
  logger.error(`❌ Job fallido: ${job?.id} - ${error.message}`);
});

module.exports = {
  screenshotQueue,
  addScreenshotJob,
  getQueueStats,
  cleanQueue,
  pauseQueue,
  resumeQueue
};

