/**
 * Rate Limiting Middleware
 * Prevents abuse and manages TradingView API limits
 */

const rateLimit = require('express-rate-limit');
const { apiLogger } = require('../utils/logger');
const config = require('../../config');

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    apiLogger.warn({
      ip: req.ip,
      url: req.url,
      method: req.method
    }, 'Rate limit exceeded');

    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
    });
  }
});

// Stricter rate limiting for bulk operations
const bulkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 bulk operations per minute
  message: {
    error: 'Bulk operation rate limit exceeded. Please wait before making another bulk request.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    apiLogger.warn({
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent')
    }, 'Bulk rate limit exceeded');

    res.status(429).json({
      error: 'Bulk operation rate limit exceeded. Please wait before making another bulk request.',
      retryAfter: 60
    });
  }
});

// TradingView API specific rate limiting
const tradingViewLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute to TradingView
  message: {
    error: 'TradingView API rate limit reached. Please slow down your requests.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    apiLogger.warn({
      ip: req.ip,
      url: req.url,
      method: req.method
    }, 'TradingView API rate limit exceeded');

    res.status(429).json({
      error: 'TradingView API rate limit reached. Please slow down your requests.',
      retryAfter: 60
    });
  }
});

module.exports = {
  apiLimiter,
  bulkLimiter,
  tradingViewLimiter
};
