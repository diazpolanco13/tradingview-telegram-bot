/**
 * TradingView Telegram Bot Server
 * Send TradingView alerts with chart screenshots to Telegram
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const { logger } = require('./utils/logger');
const { initAdminAuth } = require('./utils/adminAuth');
const screenshotService = require('./services/screenshotService');
const telegramService = require('./services/telegramService');

// Routes
const webhookRoutes = require('./routes/webhook');
const { router: adminRoutes, cookieManager } = require('./routes/admin');

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
app.use(express.text({ limit: '10mb' })); // Para alertas de TradingView en texto plano

// Static files (admin panel)
app.use(express.static(path.join(__dirname, '../public')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'TradingView Telegram Bot - Node.js',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /health',
      webhook: 'POST /webhook (MAIN ENDPOINT)',
      admin: 'GET /admin (REQUIRES TOKEN)',
      adminToken: 'GET /admin-token (LOCALHOST ONLY)'
    },
    quickLinks: {
      adminPanel: `http://localhost:${process.env.PORT || 5002}/admin`,
      documentation: 'https://github.com/diazpolanco13/tradingview-telegram-bot'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      telegram: telegramService.initialized,
      puppeteer: screenshotService.initialized
    }
  });
});

// Routes
app.use(webhookRoutes);
app.use(adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.url}`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /webhook',
      'GET /admin',
      'GET /admin-token'
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
const PORT = process.env.PORT || 5002;

async function startServer() {
  try {
    logger.info('🚀 Starting TradingView Telegram Bot...');

    // Initialize admin authentication
    await initAdminAuth();

    // Initialize services
    logger.info('Initializing Telegram service...');
    try {
      telegramService.init();
    } catch (error) {
      logger.warn({ error: error.message }, '⚠️ Telegram service not configured (this is OK for testing)');
    }
    
    logger.info('Initializing Screenshot service...');
    try {
      await screenshotService.init();
    } catch (error) {
      logger.warn({ error: error.message }, '⚠️ Screenshot service not available (requires Chromium in Docker)');
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════╗
║  📱 TradingView Telegram Bot - Running                     ║
║                                                            ║
║  🌐 Server:     http://localhost:${PORT}                   ║
║  🎛️  Admin:      http://localhost:${PORT}/admin            ║
║  📡 Webhook:     http://localhost:${PORT}/webhook          ║
║  ❤️  Health:     http://localhost:${PORT}/health           ║
║                                                            ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                 ║
║  Telegram Bot: ${telegramService.initialized ? '✅ Ready' : '❌ Not configured'}                       ║
║  Puppeteer: ${screenshotService.initialized ? '✅ Ready' : '❌ Not initialized'}                        ║
╚════════════════════════════════════════════════════════════╝
      `);

      logger.info('Bot está listo para recibir alertas de TradingView');
    });

  } catch (error) {
    logger.error({ error: error.message }, '❌ Error starting server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await screenshotService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await screenshotService.close();
  process.exit(0);
});

// Start server
startServer();

module.exports = app;
