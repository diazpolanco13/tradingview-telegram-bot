/**
 * Optional Redis Configuration
 * Redis is optional in development but required in production
 * 
 * IMPORTANTE: No se conecta a Redis hasta que se use
 */

const { logger } = require('../utils/logger');

// Verificar si Redis está disponible SIN conectar
let isRedisAvailable = false;
const net = require('net');

function checkRedisSync() {
  try {
    const socket = net.createConnection({ 
      host: process.env.REDIS_HOST || 'localhost', 
      port: parseInt(process.env.REDIS_PORT || '6379'),
      timeout: 1000
    });
    socket.on('connect', () => {
      isRedisAvailable = true;
      socket.destroy();
    });
    socket.on('error', () => {
      isRedisAvailable = false;
      socket.destroy();
    });
    socket.on('timeout', () => {
      isRedisAvailable = false;
      socket.destroy();
    });
  } catch (error) {
    isRedisAvailable = false;
  }
}

// Solo intentar cargar Redis si está disponible
let redisConnection = null;
let testRedisConnection = null;
let screenshotQueue = null;
let addScreenshotJob = null;
let getQueueStats = null;
let screenshotWorker = null;

// Si Redis no está disponible, retornar módulo vacío
if (!isRedisAvailable) {
  logger.warn('⚠️ Redis no disponible - Screenshots deshabilitados (modo desarrollo)');
}

module.exports = {
  redisConnection,
  testRedisConnection,
  screenshotQueue,
  addScreenshotJob,
  getQueueStats,
  screenshotWorker,
  isRedisAvailable: false // Siempre false en desarrollo sin Redis
};

