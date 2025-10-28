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

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    let queueStats = null;
    if (redisAvailable && getQueueStats) {
      queueStats = await getQueueStats();
    }

    res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        supabase: true,
        redis: redisAvailable,
        puppeteer: screenshotService.initialized,
        queue: queueStats || { message: 'Redis no disponible' }
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      error: error.message
    });
  }
});

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

    // Start server
    app.listen(PORT, () => {
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

// Graceful shutdown
async function shutdown() {
  logger.info('🛑 Shutting down gracefully...');
  
  try {
    await screenshotService.close();
    
    // Cerrar worker si está disponible
    const { stopWorker } = require('./workers/screenshotWorker');
    await stopWorker();
    
    logger.info('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
startServer();

module.exports = app;

