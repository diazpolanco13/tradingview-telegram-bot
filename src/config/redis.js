/**
 * Redis Configuration for BullMQ
 * Configuración de conexión a Redis para el sistema de colas
 */

const Redis = require('ioredis');
const { logger } = require('../utils/logger');

/**
 * Configuración de Redis según el entorno
 */
function getRedisConfig() {
  // Si existe REDIS_URL (Railway, Heroku, etc)
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  // Configuración manual
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Requerido por BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`⚠️ Reintentando conexión a Redis (intento ${times})...`);
      return delay;
    }
  };
}

/**
 * Cliente Redis para BullMQ
 */
const redisConnection = new Redis(getRedisConfig());

redisConnection.on('connect', () => {
  logger.info('✅ Redis conectado correctamente');
});

redisConnection.on('error', (error) => {
  logger.error('❌ Error de conexión a Redis:', error.message);
});

redisConnection.on('close', () => {
  logger.warn('⚠️ Conexión a Redis cerrada');
});

/**
 * Verificar conexión a Redis
 */
async function testRedisConnection() {
  try {
    await redisConnection.ping();
    logger.info('✅ Redis PING exitoso');
    return true;
  } catch (error) {
    logger.error('❌ Redis no responde:', error.message);
    return false;
  }
}

module.exports = {
  redisConnection,
  testRedisConnection
};

