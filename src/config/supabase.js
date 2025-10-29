/**
 * Supabase Client Configuration
 * Cliente para interactuar con la base de datos Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');
const { validateQuota } = require('./plans');

// Validar que las variables de entorno existan
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas en .env');
  process.exit(1);
}

/**
 * Cliente de Supabase con Service Role Key
 * Tiene acceso completo bypass RLS para operaciones del microservicio
 */
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

/**
 * Verificar conexión a Supabase
 */
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('trading_signals_config')
      .select('count')
      .limit(1);

    if (error) throw error;

    logger.info('✅ Supabase conectado correctamente');
    return true;
  } catch (error) {
    logger.error('❌ Error conectando a Supabase:', error.message);
    return false;
  }
}

/**
 * Validar webhook token y obtener configuración del usuario
 * @param {string} webhookToken - Token del webhook
 * @returns {Promise<Object|null>} - Configuración del usuario o null
 */
async function validateWebhookToken(webhookToken) {
  try {
    const { data, error } = await supabase
      .from('trading_signals_config')
      .select(`
        id,
        user_id,
        webhook_enabled,
        signals_quota,
        signals_used_this_month,
        user_plan,
        default_chart_id,
        tv_sessionid,
        tv_sessionid_sign,
        cookies_valid,
        screenshot_resolution,
        preferred_timezone
      `)
      .eq('webhook_token', webhookToken)
      .eq('webhook_enabled', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        logger.warn(`⚠️ Webhook token no encontrado: ${webhookToken.substring(0, 8)}...`);
        return null;
      }
      throw error;
    }

    // Verificar cuota usando el sistema configurable
    const quotaValid = validateQuota(
      data.signals_used_this_month,
      data.signals_quota,
      data.user_id
    );

    if (!quotaValid) {
      // Cuota excedida en modo strict
      return null;
    }

    return data;
  } catch (error) {
    logger.error('❌ Error validando webhook token:', error.message);
    return null;
  }
}

/**
 * Insertar nueva señal en la base de datos
 * @param {Object} signalData - Datos de la señal
 * @returns {Promise<Object|null>} - Señal insertada o null
 */
async function insertSignal(signalData) {
  try {
    const { data, error } = await supabase
      .from('trading_signals')
      .insert([signalData])
      .select()
      .single();

    if (error) throw error;

    logger.info(`✅ Señal insertada: ${data.id} - ${data.ticker}`);
    return data;
  } catch (error) {
    logger.error('❌ Error insertando señal:', error.message);
    return null;
  }
}

/**
 * Actualizar estado del screenshot
 * @param {string} signalId - ID de la señal
 * @param {string} status - Estado del screenshot
 * @param {string} screenshotUrl - URL del screenshot (opcional)
 * @returns {Promise<boolean>}
 */
async function updateScreenshotStatus(signalId, status, screenshotUrl = null) {
  try {
    const updateData = { screenshot_status: status };
    if (screenshotUrl) {
      updateData.screenshot_url = screenshotUrl;
    }

    const { error } = await supabase
      .from('trading_signals')
      .update(updateData)
      .eq('id', signalId);

    if (error) throw error;

    logger.info(`✅ Screenshot actualizado: ${signalId} - ${status}`);
    return true;
  } catch (error) {
    logger.error('❌ Error actualizando screenshot:', error.message);
    return false;
  }
}

/**
 * Incrementar contador de uso del webhook
 * @param {string} webhookToken - Token del webhook
 */
async function incrementWebhookUsage(webhookToken) {
  try {
    const { error } = await supabase.rpc('increment_webhook_usage', {
      p_webhook_token: webhookToken
    });

    if (error) throw error;
  } catch (error) {
    logger.error('❌ Error incrementando uso del webhook:', error.message);
  }
}

// ⚠️ ELIMINADO: uploadScreenshot()
// El sistema ahora usa exclusivamente TradingView CDN URLs
// No se suben imágenes a Supabase Storage

/**
 * Obtener configuración del usuario por user_id
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object|null>}
 */
async function getUserConfig(userId) {
  try {
    const { data, error } = await supabase
      .from('trading_signals_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('❌ Error obteniendo config del usuario:', error.message);
    return null;
  }
}

module.exports = {
  supabase,
  testConnection,
  validateWebhookToken,
  insertSignal,
  updateScreenshotStatus,
  incrementWebhookUsage,
  getUserConfig
};

