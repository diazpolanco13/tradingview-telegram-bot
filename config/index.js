/**
 * Application Configuration
 */

require('dotenv').config();

const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // TradingView Credentials
  tvUsername: process.env.TV_USERNAME,
  tvPassword: process.env.TV_PASSWORD,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // Bulk Operations
  bulk: {
    batchSize: parseInt(process.env.BULK_BATCH_SIZE) || 10,
    delayMs: parseInt(process.env.BULK_DELAY_MS) || 100
  },

  // Session storage
  sessionFile: 'session_db.json'
};

module.exports = config;
