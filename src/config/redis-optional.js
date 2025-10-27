/**
 * Optional Redis Configuration
 * Redis is optional in development but required in production
 * 
 * IMPORTANTE: Se basa en variables de entorno para determinar disponibilidad
 */

const { logger } = require('../utils/logger');

// Verificar si Redis está configurado (basado en variables de entorno)
const isRedisAvailable = !!(process.env.REDIS_HOST || process.env.REDIS_URL);

if (!isRedisAvailable) {
  logger.warn('⚠️ Redis no disponible - Screenshots deshabilitados (modo desarrollo)');
}

// Cargar módulos de Redis solo si está configurado
let redisConnection = null;
let testRedisConnection = null;
let screenshotQueue = null;
let addScreenshotJob = null;
let getQueueStats = null;
let screenshotWorker = null;

if (isRedisAvailable) {
  try {
    logger.info('🔌 Redis detectado - Cargando BullMQ...');
    
    // Importar configuración de Redis
    const redisConfig = require('./redis');
    redisConnection = redisConfig.redisConnection;
    testRedisConnection = redisConfig.testRedisConnection;
    
    // Importar Queue
    const queueConfig = require('../queues/screenshotQueue');
    screenshotQueue = queueConfig.screenshotQueue;
    addScreenshotJob = queueConfig.addScreenshotJob;
    getQueueStats = queueConfig.getQueueStats;
    
    // Iniciar Worker después de que Redis esté conectado
    setImmediate(() => {
      try {
        const { startWorker } = require('../workers/screenshotWorker');
        screenshotWorker = startWorker(redisConnection);
      } catch (workerError) {
        logger.error('❌ Error inicializando worker:', workerError.message);
      }
    });
    
    logger.info('✅ BullMQ Queue cargada correctamente');
  } catch (error) {
    logger.error('❌ Error cargando BullMQ:', error.message);
    logger.warn('⚠️ Screenshots deshabilitados');
  }
} else {
  logger.warn('⚠️ Redis no configurado - Modo desarrollo sin screenshots');
}

module.exports = {
  redisConnection,
  testRedisConnection,
  screenshotQueue,
  addScreenshotJob,
  getQueueStats,
  screenshotWorker,
  isRedisAvailable // Export actual status
};
