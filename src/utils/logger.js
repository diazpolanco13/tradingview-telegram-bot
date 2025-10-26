/**
 * Logging System using Pino
 * High-performance logging for bulk operations
 */

const pino = require('pino');
const config = require('../../config');

const logger = pino({
  level: config.logLevel,
  transport: config.nodeEnv === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    error: pino.stdSerializers.err
  }
});

// Specialized loggers for bulk operations
const bulkLogger = logger.child({ component: 'bulk-operations' });
const authLogger = logger.child({ component: 'authentication' });
const apiLogger = logger.child({ component: 'api' });

// Add utility methods to bulkLogger
bulkLogger.logBulkStart = (operation, totalItems) => {
  bulkLogger.info({ operation, totalItems }, `Starting bulk ${operation}`);
};

bulkLogger.logBulkProgress = (operation, processed, total, batchSize) => {
  bulkLogger.info({
    operation,
    processed,
    total,
    batchSize,
    progress: `${processed}/${total} (${Math.round(processed/total*100)}%)`
  }, `Bulk ${operation} progress`);
};

bulkLogger.logBulkComplete = (operation, totalItems, duration, successCount, errorCount) => {
  bulkLogger.info({
    operation,
    totalItems,
    duration,
    successCount,
    errorCount,
    successRate: `${Math.round(successCount/totalItems*100)}%`
  }, `Bulk ${operation} completed`);
};

bulkLogger.logBulkError = (operation, error, context = {}) => {
  bulkLogger.error({ operation, error: error.message, ...context }, `Bulk ${operation} error`);
};

module.exports = {
  logger,
  bulkLogger,
  authLogger,
  apiLogger
};
