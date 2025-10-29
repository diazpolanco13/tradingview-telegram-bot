/**
 * Admin V2 Routes - Testing Panel para Microservicio
 * Endpoints de testing y desarrollo para el panel admin V2
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { apiLogger: logger } = require('../utils/logger');
const { supabase, getUserConfig } = require('../config/supabase');
const { encrypt, decrypt } = require('../utils/encryption');
const { getPool } = require('../services/browserPool');
const { 
  PLANS_CONFIG, 
  DEFAULT_QUOTA, 
  FALLBACK_QUOTA, 
  QUOTA_MODE,
  getUsagePercentage,
  getQuotaWarning
} = require('../config/plans');

/**
 * GET /admin
 * Panel de testing del microservicio
 */
router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin.html'));
});

/**
 * GET /test/supabase
 * Probar conexión a Supabase
 */
router.get('/test/supabase', async (req, res) => {
  try {
    // Test 1: Contar configuraciones
    const { count: configCount, error: configError } = await supabase
      .from('trading_signals_config')
      .select('*', { count: 'exact', head: true });

    if (configError) throw configError;

    // Test 2: Contar señales
    const { count: signalsCount, error: signalsError } = await supabase
      .from('trading_signals')
      .select('*', { count: 'exact', head: true });

    if (signalsError) throw signalsError;

    // Test 3: Verificar bucket
    const { data: buckets, error: bucketError } = await supabase.storage
      .listBuckets();

    if (bucketError) throw bucketError;

    const screenshotBucket = buckets?.find(b => b.name === 'trading-screenshots');

    res.json({
      success: true,
      message: 'Conexión a Supabase exitosa ✅',
      stats: {
        total_configs: configCount || 0,
        total_signals: signalsCount || 0,
        screenshot_bucket_exists: !!screenshotBucket,
        buckets: buckets?.length || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error testing Supabase');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /test/user-config/:userId
 * Obtener configuración de un usuario específico
 */
router.get('/test/user-config/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const config = await getUserConfig(userId);

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado o sin configuración'
      });
    }

    // Ocultar cookies encriptadas en respuesta
    const safeConfig = { ...config };
    if (safeConfig.tv_sessionid) {
      safeConfig.tv_sessionid = '[ENCRYPTED - Hidden for security]';
    }
    if (safeConfig.tv_sessionid_sign) {
      safeConfig.tv_sessionid_sign = '[ENCRYPTED - Hidden for security]';
    }

    res.json({
      success: true,
      data: safeConfig
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error getting user config');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /test/signals
 * Obtener señales recientes (todas, para testing)
 */
router.get('/test/signals', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const { data, error, count } = await supabase
      .from('trading_signals')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      success: true,
      total: count,
      limit,
      data: data || []
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error getting signals');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /test/encryption
 * Probar encriptación y desencriptación
 */
router.post('/test/encryption', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Proporciona un texto a encriptar'
      });
    }

    // Encriptar
    const encrypted = encrypt(text);

    // Desencriptar
    const decrypted = decrypt(encrypted);

    // Verificar
    const isValid = text === decrypted;

    res.json({
      success: true,
      original: text,
      encrypted: encrypted.substring(0, 50) + '...',
      encrypted_length: encrypted.length,
      decrypted: decrypted,
      validation: isValid ? '✅ OK' : '❌ FAILED'
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error testing encryption');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /test/database-stats
 * Estadísticas generales de la base de datos
 */
router.get('/test/database-stats', async (req, res) => {
  try {
    // Contar por tabla
    const [
      { count: totalConfigs },
      { count: totalSignals },
      { count: totalStats },
      { count: signalsPending },
      { count: signalsCompleted },
      { count: signalsFailed }
    ] = await Promise.all([
      supabase.from('trading_signals_config').select('*', { count: 'exact', head: true }),
      supabase.from('trading_signals').select('*', { count: 'exact', head: true }),
      supabase.from('trading_signals_stats').select('*', { count: 'exact', head: true }),
      supabase.from('trading_signals').select('*', { count: 'exact', head: true }).eq('screenshot_status', 'pending'),
      supabase.from('trading_signals').select('*', { count: 'exact', head: true }).eq('screenshot_status', 'completed'),
      supabase.from('trading_signals').select('*', { count: 'exact', head: true }).eq('screenshot_status', 'failed')
    ]);

    // Top 5 usuarios con más señales
    const { data: topUsers } = await supabase
      .from('trading_signals')
      .select('user_id')
      .limit(1000);

    const userCounts = {};
    topUsers?.forEach(signal => {
      userCounts[signal.user_id] = (userCounts[signal.user_id] || 0) + 1;
    });

    const topUsersList = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, count]) => ({ user_id: userId, signal_count: count }));

    res.json({
      success: true,
      stats: {
        total_users_with_config: totalConfigs || 0,
        total_signals: totalSignals || 0,
        total_stats_records: totalStats || 0,
        screenshots: {
          pending: signalsPending || 0,
          completed: signalsCompleted || 0,
          failed: signalsFailed || 0
        },
        top_users: topUsersList
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error getting database stats');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /test/create-test-signal
 * Crear una señal de prueba para un usuario
 */
router.post('/test/create-test-signal', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'Proporciona un user_id'
      });
    }

    // Verificar que el usuario tenga config
    const { data: config } = await supabase
      .from('trading_signals_config')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no tiene configuración. Crea un usuario primero.'
      });
    }

    // Crear señal de prueba
    const testSignal = {
      user_id,
      indicator_name: 'Test Indicator',
      ticker: 'BINANCE:BTCUSDT',
      exchange: 'BINANCE',
      symbol: 'BTCUSDT',
      price: 45000 + Math.random() * 1000,
      signal_type: 'TEST_SIGNAL',
      direction: Math.random() > 0.5 ? 'LONG' : 'SHORT',
      screenshot_status: 'pending',
      raw_message: 'Test signal created from admin panel',
      parsed_data: { test: true },
      timestamp: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('trading_signals')
      .insert([testSignal])
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Señal de prueba creada ✅',
      data
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error creating test signal');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /test/clear-test-signals
 * Eliminar todas las señales de prueba
 */
router.delete('/test/clear-test-signals', async (req, res) => {
  try {
    const { error } = await supabase
      .from('trading_signals')
      .delete()
      .eq('signal_type', 'TEST_SIGNAL');

    if (error) throw error;

    res.json({
      success: true,
      message: 'Señales de prueba eliminadas ✅'
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error clearing test signals');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /test/browser-pool-stats
 * Obtener estadísticas del pool de browsers
 */
router.get('/test/browser-pool-stats', async (req, res) => {
  try {
    const pool = getPool();
    
    if (!pool.initialized) {
      return res.json({
        success: true,
        message: 'Pool no inicializado aún',
        initialized: false
      });
    }

    const stats = pool.getStats();

    res.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error getting pool stats');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /test/plans
 * Ver configuración de planes y cuotas desde variables de entorno
 */
router.get('/test/plans', async (req, res) => {
  try {
    // Formatear planes
    const plans = Object.entries(PLANS_CONFIG).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      quota: plan.quota,
      quotaText: plan.quota === -1 ? 'Ilimitado' : `${plan.quota} señales/mes`,
      screenshots: plan.screenshots,
      resolution: plan.resolution,
      telegram: plan.telegram
    }));

    // Obtener estadísticas de usuarios por plan
    const { data: userConfigs, error } = await supabase
      .from('trading_signals_config')
      .select('signals_quota, signals_used_this_month, user_id');

    let userStats = {};
    if (!error && userConfigs) {
      userConfigs.forEach(config => {
        const quota = config.signals_quota;
        if (!userStats[quota]) {
          userStats[quota] = {
            count: 0,
            totalUsed: 0,
            avgUsage: 0
          };
        }
        userStats[quota].count++;
        userStats[quota].totalUsed += config.signals_used_this_month || 0;
      });

      // Calcular promedios
      Object.keys(userStats).forEach(quota => {
        userStats[quota].avgUsage = Math.round(
          userStats[quota].totalUsed / userStats[quota].count
        );
      });
    }

    res.json({
      success: true,
      config: {
        plans,
        defaults: {
          default_quota: DEFAULT_QUOTA,
          fallback_quota: FALLBACK_QUOTA,
          quota_mode: QUOTA_MODE
        },
        environment: {
          PLAN_FREE_QUOTA: process.env.PLAN_FREE_QUOTA || 'not set (default: 100)',
          PLAN_BASIC_QUOTA: process.env.PLAN_BASIC_QUOTA || 'not set (default: 250)',
          PLAN_PRO_QUOTA: process.env.PLAN_PRO_QUOTA || 'not set (default: 500)',
          PLAN_PREMIUM_QUOTA: process.env.PLAN_PREMIUM_QUOTA || 'not set (default: -1)',
          PLAN_ENTERPRISE_QUOTA: process.env.PLAN_ENTERPRISE_QUOTA || 'not set (default: -1)',
          DEFAULT_QUOTA: process.env.DEFAULT_QUOTA || 'not set (default: 100)',
          FALLBACK_QUOTA: process.env.FALLBACK_QUOTA || 'not set (default: 50)',
          QUOTA_MODE: process.env.QUOTA_MODE || 'not set (default: strict)'
        },
        userStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error getting plans config');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /test/quota/:userId
 * Ver estado de cuota de un usuario específico
 */
router.get('/test/quota/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: config, error } = await supabase
      .from('trading_signals_config')
      .select('signals_quota, signals_used_this_month, webhook_token')
      .eq('user_id', userId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const percentage = getUsagePercentage(
      config.signals_used_this_month,
      config.signals_quota
    );

    const warning = getQuotaWarning(
      config.signals_used_this_month,
      config.signals_quota
    );

    const remaining = config.signals_quota === -1 
      ? -1 
      : Math.max(0, config.signals_quota - config.signals_used_this_month);

    res.json({
      success: true,
      quota: {
        user_id: userId,
        total: config.signals_quota,
        used: config.signals_used_this_month,
        remaining,
        percentage: percentage === -1 ? 'Ilimitado' : `${percentage}%`,
        status: percentage >= 100 ? 'EXCEDIDO' : percentage >= 90 ? 'CRÍTICO' : percentage >= 75 ? 'ADVERTENCIA' : 'OK',
        warning,
        webhook_token_preview: config.webhook_token.substring(0, 16) + '...',
        can_receive_signals: remaining > 0 || remaining === -1
      }
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error getting quota info');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /admin/metrics
 * Dashboard completo de métricas del sistema
 */
router.get('/admin/metrics', async (req, res) => {
  try {
    const startTime = process.uptime();
    const pool = getPool();
    const { getWorkerInstance } = require('../workers/screenshotWorker');
    const worker = getWorkerInstance();

    // 1. BROWSER POOL STATS
    const poolStats = pool?.getStats() || {
      total: 0,
      available: 0,
      inUse: 0,
      totalCreated: 0,
      totalClosed: 0,
      totalCaptures: 0,
      activeCaptures: 0
    };

    // 2. BULLMQ QUEUE STATS
    let queueStats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0
    };

    if (worker) {
      try {
        const { Queue } = require('bullmq');
        const { getRedisConnection } = require('../config/redis-optional');
        const redis = getRedisConnection();
        
        if (redis) {
          const queue = new Queue('screenshot-processing', { connection: redis });
          const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
          queueStats = counts;
        }
      } catch (queueError) {
        logger.warn('No se pudieron obtener stats de BullMQ');
      }
    }

    // 3. SUPABASE STATS
    const { count: totalSignals } = await supabase
      .from('trading_signals')
      .select('*', { count: 'exact', head: true });

    const { count: totalUsers } = await supabase
      .from('trading_signals_config')
      .select('*', { count: 'exact', head: true });

    // Señales de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: signalsToday } = await supabase
      .from('trading_signals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // 4. PERFORMANCE METRICS
    const screenshotsCompleted = queueStats.completed || 0;
    const screenshotsFailed = queueStats.failed || 0;
    const totalScreenshots = screenshotsCompleted + screenshotsFailed;
    const successRate = totalScreenshots > 0 
      ? ((screenshotsCompleted / totalScreenshots) * 100).toFixed(2)
      : 100;

    // Estimación de screenshots por hora (basado en active + waiting)
    const estimatedPerHour = (queueStats.active + queueStats.waiting) * 6; // Asumiendo 10 workers = 60/min = 360/hr

    // 5. CAPACITY ANALYSIS
    const maxConcurrency = parseInt(process.env.WORKER_CONCURRENCY) || 10;
    const maxBrowsers = parseInt(process.env.POOL_MAX_BROWSERS) || 12;
    const currentLoad = poolStats.total > 0 
      ? ((poolStats.inUse / poolStats.total) * 100).toFixed(1)
      : 0;

    // Estimación de usuarios soportados (500 alerts/día por usuario)
    const screenshotsPerDay = screenshotsCompleted * (24 / (startTime / 3600)); // Extrapolación
    const estimatedUsers = Math.floor(screenshotsPerDay / 500);
    const maxCapacity = 345; // De nuestro cálculo anterior

    // 6. UPTIME FORMATTING
    const uptimeSeconds = Math.floor(startTime);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeFormatted = days > 0 
      ? `${days}d ${hours}h ${minutes}m`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      uptime: uptimeFormatted,
      uptimeSeconds: uptimeSeconds,
      
      browserPool: {
        total: poolStats.total,
        available: poolStats.available,
        inUse: poolStats.inUse,
        status: poolStats.inUse / poolStats.total > 0.8 ? 'saturated' : 
                poolStats.inUse / poolStats.total > 0.5 ? 'busy' : 'healthy',
        totalCreated: poolStats.totalCreated,
        totalClosed: poolStats.totalClosed,
        totalCaptures: poolStats.totalCaptures,
        activeCaptures: poolStats.activeCaptures
      },

      queue: {
        waiting: queueStats.waiting,
        active: queueStats.active,
        completed: queueStats.completed,
        failed: queueStats.failed,
        delayed: queueStats.delayed,
        paused: queueStats.paused,
        total: queueStats.waiting + queueStats.active + queueStats.completed + queueStats.failed
      },

      performance: {
        screenshotsCompleted: screenshotsCompleted,
        screenshotsFailed: screenshotsFailed,
        successRate: `${successRate}%`,
        estimatedPerHour: estimatedPerHour,
        screenshotsToday: signalsToday || 0,
        avgScreenshotTime: poolStats.totalCaptures > 0 
          ? `${((uptimeSeconds / poolStats.totalCaptures)).toFixed(1)}s`
          : 'N/A'
      },

      capacity: {
        currentLoad: `${currentLoad}%`,
        maxConcurrency: maxConcurrency,
        maxBrowsers: maxBrowsers,
        estimatedUsers: estimatedUsers,
        maxCapacity: maxCapacity,
        utilizationPercent: ((estimatedUsers / maxCapacity) * 100).toFixed(1)
      },

      database: {
        totalSignals: totalSignals || 0,
        totalUsers: totalUsers || 0,
        signalsToday: signalsToday || 0
      },

      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
          total: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`
        }
      }
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error getting metrics');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /admin/pool-status
 * Estado detallado del Browser Pool
 */
router.get('/admin/pool-status', async (req, res) => {
  try {
    const pool = getPool();
    
    if (!pool || !pool.initialized) {
      return res.json({
        success: true,
        initialized: false,
        message: 'Browser pool no inicializado (se inicializa con el primer screenshot)'
      });
    }

    const stats = pool.getStats();
    const browsers = pool.pool.map((slot, index) => ({
      id: slot.id,
      status: slot.inUse ? 'in_use' : 'available',
      lastUsed: slot.lastUsed ? `${Math.floor((Date.now() - slot.lastUsed) / 1000)}s ago` : 'never',
      createdAt: slot.createdAt ? new Date(slot.createdAt).toISOString() : null,
      uptime: slot.createdAt ? `${Math.floor((Date.now() - slot.createdAt) / 1000 / 60)}m` : 'N/A'
    }));

    res.json({
      success: true,
      initialized: true,
      config: {
        minBrowsers: pool.config.minBrowsers,
        maxBrowsers: pool.config.maxBrowsers,
        idleTimeout: `${pool.config.idleTimeout / 1000 / 60}min`,
        cleanupInterval: `${pool.config.cleanupInterval / 1000 / 60}min`,
        warmup: pool.config.warmup
      },
      stats: {
        total: stats.total,
        available: stats.available,
        inUse: stats.inUse,
        totalCreated: stats.totalCreated,
        totalClosed: stats.totalClosed,
        totalCaptures: stats.totalCaptures,
        activeCaptures: stats.activeCaptures
      },
      browsers: browsers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error getting pool status');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /admin/queue-stats
 * Estadísticas detalladas de la cola BullMQ
 */
router.get('/admin/queue-stats', async (req, res) => {
  try {
    const { Queue } = require('bullmq');
    const { getRedisConnection } = require('../config/redis-optional');
    const redis = getRedisConnection();

    if (!redis) {
      return res.json({
        success: false,
        message: 'Redis no disponible'
      });
    }

    const queue = new Queue('screenshot-processing', { connection: redis });
    
    // Obtener counts
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
    
    // Obtener jobs recientes (últimos 10 completados)
    const completedJobs = await queue.getJobs(['completed'], 0, 9, true);
    const recentCompleted = completedJobs.map(job => ({
      id: job.id,
      status: 'completed',
      processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      duration: job.finishedOn && job.processedOn 
        ? `${((job.finishedOn - job.processedOn) / 1000).toFixed(1)}s`
        : 'N/A',
      data: {
        ticker: job.data?.ticker,
        userId: job.data?.userId?.substring(0, 8) + '...'
      }
    }));

    // Obtener jobs activos
    const activeJobs = await queue.getJobs(['active'], 0, 9, true);
    const recentActive = activeJobs.map(job => ({
      id: job.id,
      status: 'active',
      processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      data: {
        ticker: job.data?.ticker,
        userId: job.data?.userId?.substring(0, 8) + '...'
      }
    }));

    res.json({
      success: true,
      counts: counts,
      recentCompleted: recentCompleted,
      activeJobs: recentActive,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({ error: error.message }, 'Error getting queue stats');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

