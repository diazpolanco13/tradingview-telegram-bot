/**
 * Dashboard API Endpoints
 * Endpoints para que Next.js consuma datos del microservicio
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { encryptTradingViewCookies } = require('../utils/encryption');
const { logger } = require('../utils/logger');

/**
 * Middleware de autenticación (verifica JWT de Supabase)
 * En producción, Next.js validará el token y lo enviará en el header
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticación requerido'
      });
    }

    const token = authHeader.substring(7);

    // Verificar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error autenticando usuario');
    res.status(500).json({
      success: false,
      error: 'Error de autenticación'
    });
  }
}

/**
 * GET /api/signals
 * Obtener señales del usuario autenticado
 * Query params:
 * - limit: número de señales (default: 50)
 * - offset: para paginación (default: 0)
 * - result: filtrar por resultado (win, loss, pending, etc)
 */
router.get('/signals', authenticateUser, async (req, res) => {
  try {
    const { limit = 50, offset = 0, result } = req.query;
    const userId = req.user.id;

    let query = supabase
      .from('trading_signals')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    // Filtrar por resultado si se especifica
    if (result && result !== 'all') {
      query = query.eq('result', result);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error obteniendo señales');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/signals/:id
 * Obtener detalles de una señal específica
 */
router.get('/signals/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Señal no encontrada'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error obteniendo señal');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/signals/:id
 * Actualizar resultado de una señal (usuario edita manualmente)
 */
router.put('/signals/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { 
      result, 
      entry_price, 
      exit_price, 
      profit_loss, 
      profit_loss_percent, 
      notes 
    } = req.body;

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (result) updateData.result = result;
    if (entry_price !== undefined) updateData.entry_price = entry_price;
    if (exit_price !== undefined) updateData.exit_price = exit_price;
    if (profit_loss !== undefined) updateData.profit_loss = profit_loss;
    if (profit_loss_percent !== undefined) updateData.profit_loss_percent = profit_loss_percent;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from('trading_signals')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error actualizando señal');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/signals/:id
 * Eliminar una señal
 */
router.delete('/signals/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('trading_signals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Señal eliminada correctamente'
    });
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error eliminando señal');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/config
 * Obtener configuración del usuario
 */
router.get('/config', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('trading_signals_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    // No enviar cookies encriptadas al cliente
    const safeData = { ...data };
    delete safeData.tv_sessionid;
    delete safeData.tv_sessionid_sign;

    res.json({
      success: true,
      data: safeData
    });
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error obteniendo configuración');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/config
 * Actualizar configuración del usuario
 */
router.put('/config', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      default_chart_id,
      screenshot_resolution,
      preferred_timezone,
      telegram_enabled,
      telegram_chat_id,
      discord_webhook_url,
      email_notifications,
      tv_sessionid_plain,
      tv_sessionid_sign_plain
    } = req.body;

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (default_chart_id !== undefined) updateData.default_chart_id = default_chart_id;
    if (screenshot_resolution) updateData.screenshot_resolution = screenshot_resolution;
    if (preferred_timezone) updateData.preferred_timezone = preferred_timezone;
    if (telegram_enabled !== undefined) updateData.telegram_enabled = telegram_enabled;
    if (telegram_chat_id) updateData.telegram_chat_id = telegram_chat_id;
    if (discord_webhook_url !== undefined) updateData.discord_webhook_url = discord_webhook_url;
    if (email_notifications !== undefined) updateData.email_notifications = email_notifications;

    // Si se envían cookies nuevas, encriptarlas
    if (tv_sessionid_plain && tv_sessionid_sign_plain) {
      const encrypted = encryptTradingViewCookies(tv_sessionid_plain, tv_sessionid_sign_plain);
      updateData.tv_sessionid = encrypted.tv_sessionid;
      updateData.tv_sessionid_sign = encrypted.tv_sessionid_sign;
      updateData.cookies_valid = true;
      updateData.cookies_updated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('trading_signals_config')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    // No enviar cookies encriptadas al cliente
    const safeData = { ...data };
    delete safeData.tv_sessionid;
    delete safeData.tv_sessionid_sign;

    res.json({
      success: true,
      data: safeData,
      message: 'Configuración actualizada correctamente'
    });
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error actualizando configuración');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/stats
 * Obtener estadísticas del usuario
 */
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('trading_signals_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: data || {
        total_signals: 0,
        wins: 0,
        losses: 0,
        win_rate: 0
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error obteniendo estadísticas');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

