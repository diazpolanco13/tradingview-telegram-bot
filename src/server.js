/**
 * TradingView Microservice Server
 * Multi-tenant system with Supabase + BullMQ
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const { logger } = require('./utils/logger');
const { testConnection: testSupabaseConnection } = require('./config/supabase');
const { logPlansConfiguration } = require('./config/plans');
const screenshotService = require('./services/screenshotService');

// Redis y BullMQ son opcionales en desarrollo
const {
  testRedisConnection,
  getQueueStats,
  isRedisAvailable: redisAvailable
} = require('./config/redis-optional');

// Routes
const webhookRoutes = require('./routes/webhook');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || '*'
    : '*',
  credentials: true
}));

// Compression
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// Static files (admin panel)
app.use(express.static(path.join(__dirname, '../public')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'TradingView Microservice - Multi-tenant V2',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /health',
      webhookV2: 'POST /webhook/:token (MAIN - Multi-tenant)',
      webhookV1: 'POST /webhook (Legacy - Single user)',
      dashboardApi: 'GET /api/* (Dashboard endpoints)',
      admin: 'GET /admin (Admin panel)'
    },
    features: [
      'Multi-tenant (usuarios independientes)',
      'Webhook único por usuario',
      'Almacenamiento en Supabase',
      'Colas asíncronas con BullMQ',
      'Screenshots personalizados por usuario',
      'API REST para dashboard Next.js'
    ]
  });
});

// Health check endpoint - MEJORADO
app.get('/health', async (req, res) => {
  const checks = {
    supabase: false,
    redis: false,
    worker: false,
    browserPool: false
  };
  
  let overallStatus = 'healthy';
  const errors = [];

  try {
    // 1. Check Supabase
    try {
      const { supabase } = require('./config/supabase');
      const { data, error } = await supabase
        .from('trading_signals_config')
        .select('id', { count: 'exact', head: true });
      
      if (error) throw error;
      checks.supabase = true;
    } catch (e) {
      checks.supabase = false;
      errors.push(`Supabase: ${e.message}`);
      overallStatus = 'degraded';
    }

    // 2. Check Redis
    if (redisAvailable) {
      try {
        const { getRedisConnection } = require('./config/redis-optional');
        const redis = getRedisConnection();
        if (redis) {
          await redis.ping();
          checks.redis = true;
        }
      } catch (e) {
        checks.redis = false;
        errors.push(`Redis: ${e.message}`);
        overallStatus = 'degraded';
      }
    } else {
      checks.redis = 'not_configured';
    }

    // 3. Check Worker
    try {
      const { getWorkerInstance } = require('./workers/screenshotWorker');
      const worker = getWorkerInstance();
      checks.worker = worker ? true : 'not_started';
    } catch (e) {
      checks.worker = false;
      errors.push(`Worker: ${e.message}`);
    }

    // 4. Check Browser Pool
    try {
      const { getPool } = require('./services/browserPool');
      const pool = getPool();
      checks.browserPool = pool?.initialized ? true : 'not_initialized';
    } catch (e) {
      checks.browserPool = false;
      errors.push(`BrowserPool: ${e.message}`);
    }

    // 5. Get Queue Stats
    let queueStats = null;
    if (redisAvailable && getQueueStats) {
      queueStats = await getQueueStats();
    }

    // Determinar HTTP status code
    const httpStatus = overallStatus === 'healthy' ? 200 : 503;

    res.status(httpStatus).json({
      status: overallStatus,
      uptime: Math.floor(process.uptime()),
      uptimeFormatted: formatUptime(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: checks,
      services: {
        supabase: checks.supabase,
        redis: checks.redis,
        worker: checks.worker,
        browserPool: checks.browserPool,
        puppeteer: screenshotService.initialized
      },
      queue: queueStats || { message: 'Redis no disponible' },
      errors: errors.length > 0 ? errors : undefined,
      memory: {
        used: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        total: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper para formatear uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// API Routes
app.use(webhookRoutes);          // POST /webhook/:token
app.use('/api', dashboardRoutes); // Dashboard API endpoints
app.use(adminRoutes);             // Admin panel

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.url}`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /webhook/:token (V2 Multi-tenant)',
      'POST /v1/webhook (V1 Legacy)',
      'GET /api/signals (Dashboard)',
      'GET /api/config (Dashboard)',
      'GET /admin'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url
  }, 'Unhandled error');

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    status: err.status || 500
  });
});

// Server startup
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    logger.info('🚀 Starting TradingView Microservice V2...');

    // Test Supabase connection
    logger.info('🔌 Conectando a Supabase...');
    try {
      const supabaseOk = await testSupabaseConnection();
      if (!supabaseOk) {
        logger.warn('⚠️ No se pudo conectar a Supabase - Verifica las variables de entorno');
      } else {
        logger.info('✅ Supabase conectado correctamente');
      }
    } catch (error) {
      logger.warn('⚠️ Error al conectar a Supabase:', error.message);
      logger.warn('⚠️ El servidor iniciará pero las funcionalidades de Supabase estarán deshabilitadas');
    }

    // Test Redis connection (opcional)
    if (redisAvailable && testRedisConnection) {
      logger.info('🔌 Conectando a Redis...');
      const redisOk = await testRedisConnection();
      if (!redisOk) {
        logger.warn('⚠️ Redis no disponible - Screenshots deshabilitados');
      }
    } else {
      logger.warn('⚠️ Redis no configurado - Modo desarrollo sin screenshots');
    }

    // Initialize Screenshot service
    logger.info('📸 Inicializando Puppeteer...');
    try {
      await screenshotService.init();
    } catch (error) {
      logger.warn({ error: error.message }, '⚠️ Screenshot service not available');
    }

    // Log plans configuration
    logger.info('📋 Cargando configuración de planes...');
    logPlansConfiguration();

    // Start server y guardar referencia para graceful shutdown
    server = app.listen(PORT, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════════╗
║  🎯 TradingView Microservice - RUNNING                         ║
║                                                                ║
║  🌐 Server:       http://localhost:${PORT}                     ║
║  📡 Webhook:      http://localhost:${PORT}/webhook/:token      ║
║  🔌 API:          http://localhost:${PORT}/api/*               ║
║  ❤️  Health:       http://localhost:${PORT}/health             ║
║  🎛️  Admin Panel:  http://localhost:${PORT}/admin              ║
║                                                                ║
║  Environment:     ${process.env.NODE_ENV || 'development'}                                    ║
║  Supabase:        ✅ Connected                                  ║
║  Redis/BullMQ:    ${redisAvailable ? '✅ Connected' : '⚠️  Not available (dev mode)'}                    ║
║  Puppeteer:       ${screenshotService.initialized ? '✅ Ready' : '❌ Not initialized'}                                   ║
║  Worker:          ${redisAvailable ? '✅ Running (concurrency: 2)' : '⚠️  Disabled (no Redis)'}                    ║
║                                                                ║
║  🚀 Microservicio listo para recibir señales multi-tenant     ║
╚════════════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    logger.error({ error: error.message }, '❌ Error starting server');
    process.exit(1);
  }
}

// Graceful shutdown - MEJORADO
let server;
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    logger.warn('⚠️ Shutdown already in progress...');
    return;
  }
  
  isShuttingDown = true;
  logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
  
  // Establecer timeout de 30 segundos para shutdown forzado
  const forceShutdownTimer = setTimeout(() => {
    logger.error('❌ Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    // 1. Dejar de aceptar nuevas conexiones
    if (server) {
      logger.info('🚫 Cerrando servidor HTTP (no aceptar nuevas conexiones)...');
      server.close(() => {
        logger.info('✅ Servidor HTTP cerrado');
      });
    }

    // 2. Cerrar worker (esperar que terminen jobs activos)
    logger.info('⏳ Esperando que terminen jobs activos...');
    const { stopWorker } = require('./workers/screenshotWorker');
    await stopWorker();
    logger.info('✅ Worker cerrado correctamente');

    // 3. Cerrar Browser Pool
    logger.info('🌐 Cerrando Browser Pool...');
    try {
      const { getPool } = require('./services/browserPool');
      const pool = getPool();
      if (pool && pool.initialized) {
        await pool.shutdown();
        logger.info('✅ Browser Pool cerrado');
      }
    } catch (e) {
      logger.warn(`⚠️ Error cerrando Browser Pool: ${e.message}`);
    }

    // 4. Cerrar Screenshot Service
    logger.info('📸 Cerrando Screenshot Service...');
    await screenshotService.close();
    logger.info('✅ Screenshot Service cerrado');

    // 5. Cerrar Redis
    if (redisAvailable) {
      logger.info('🔴 Cerrando conexión Redis...');
      try {
        const { closeRedisConnection } = require('./config/redis-optional');
        if (closeRedisConnection) {
          await closeRedisConnection();
          logger.info('✅ Redis cerrado');
        }
      } catch (e) {
        logger.warn(`⚠️ Error cerrando Redis: ${e.message}`);
      }
    }

    clearTimeout(forceShutdownTimer);
    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    clearTimeout(forceShutdownTimer);
    logger.error({ error: error.message }, '❌ Error during shutdown');
    process.exit(1);
  }
}

// Capturar señales de shutdown
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Capturar errores no manejados
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, '❌ Uncaught Exception');
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, '❌ Unhandled Promise Rejection');
  shutdown('unhandledRejection');
});

// Start server
startServer();

module.exports = app;

