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

module.exports = router;

