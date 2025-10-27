/**
 * Webhook V2 - Multi-tenant con Supabase + BullMQ
 * Endpoint optimizado para recibir alertas de TradingView por usuario
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const {
  validateWebhookToken,
  insertSignal,
  incrementWebhookUsage
} = require('../config/supabase');
const { decryptTradingViewCookies } = require('../utils/encryption');

// BullMQ es opcional (puede no estar en desarrollo local)
const { addScreenshotJob } = require('../config/redis-optional');

/**
 * POST /webhook/:token
 * Endpoint principal para recibir alertas de TradingView
 * 
 * Path Parameters:
 * - token: Token único del webhook del usuario
 * 
 * Body: Mensaje de la alerta (string o JSON)
 * Estructura JSON esperada (personalizable):
 * {
 *   "indicator": "Nombre del indicador",
 *   "ticker": "BINANCE:BTCUSDT",
 *   "exchange": "BINANCE",
 *   "symbol": "BTCUSDT",
 *   "price": 45000.50,
 *   "signal_type": "BUY_SIGNAL",
 *   "direction": "LONG",
 *   "timestamp": "2025-10-27T10:30:00Z",
 *   "chart_id": "xyz123abc",
 *   "message": "Señal de compra detectada"
 * }
 */
router.post('/webhook/:token', async (req, res) => {
  const startTime = Date.now();
  const { token } = req.params;

  try {
    // 1. VALIDAR WEBHOOK TOKEN Y OBTENER CONFIGURACIÓN DEL USUARIO
    logger.info({ token: token.substring(0, 8) + '...' }, '📨 Webhook recibido');

    const userConfig = await validateWebhookToken(token);

    if (!userConfig) {
      logger.warn({ token: token.substring(0, 8) + '...' }, '⚠️ Token inválido o deshabilitado');
      return res.status(401).json({
        success: false,
        error: 'Webhook token inválido, deshabilitado o cuota excedida'
      });
    }

    logger.info({ userId: userConfig.user_id }, '✅ Token validado correctamente');

    // 2. PARSEAR MENSAJE DE TRADINGVIEW
    let parsedData = {};
    let rawMessage = '';

    if (typeof req.body === 'string') {
      rawMessage = req.body;
      
      // Intentar parsear como JSON
      try {
        parsedData = JSON.parse(rawMessage);
      } catch {
        // Si no es JSON, extraer datos del texto
        parsedData = extractDataFromText(rawMessage);
      }
    } else if (typeof req.body === 'object') {
      parsedData = req.body;
      rawMessage = JSON.stringify(req.body, null, 2);
    } else {
      rawMessage = String(req.body || '');
    }

    // 3. CONSTRUIR DATOS DE LA SEÑAL
    const signalData = {
      user_id: userConfig.user_id,
      indicator_name: parsedData.indicator || parsedData.indicator_name || null,
      ticker: parsedData.ticker || parsedData.symbol || extractTicker(rawMessage),
      exchange: parsedData.exchange || null,
      symbol: parsedData.symbol || null,
      price: parsedData.price ? parseFloat(parsedData.price) : null,
      signal_type: parsedData.signal_type || parsedData.type || null,
      direction: parsedData.direction || null,
      chart_id: parsedData.chart_id || parsedData.chartId || userConfig.default_chart_id || null,
      screenshot_url: null,
      screenshot_status: 'pending',
      raw_message: rawMessage,
      parsed_data: parsedData,
      timestamp: parsedData.timestamp ? new Date(parsedData.timestamp) : new Date()
    };

    logger.info({ 
      ticker: signalData.ticker, 
      signal_type: signalData.signal_type 
    }, '📊 Señal parseada');

    // 4. INSERTAR SEÑAL EN SUPABASE
    const insertedSignal = await insertSignal(signalData);

    if (!insertedSignal) {
      throw new Error('No se pudo insertar la señal en la base de datos');
    }

    logger.info({ signalId: insertedSignal.id }, '✅ Señal insertada en Supabase');

    // 5. INCREMENTAR CONTADOR DE USO DEL WEBHOOK
    await incrementWebhookUsage(token);

    // 6. ENCOLAR SCREENSHOT SI HAY CHART_ID Y COOKIES VÁLIDAS
    let screenshotQueued = false;
    
    if (addScreenshotJob && signalData.chart_id && userConfig.cookies_valid && userConfig.tv_sessionid) {
      try {
        // Desencriptar cookies del usuario
        const cookies = decryptTradingViewCookies(
          userConfig.tv_sessionid,
          userConfig.tv_sessionid_sign
        );

        // Agregar job a la cola
        await addScreenshotJob({
          signalId: insertedSignal.id,
          userId: userConfig.user_id,
          ticker: signalData.ticker,
          chartId: signalData.chart_id,
          cookies: cookies,
          resolution: userConfig.screenshot_resolution || '1080p'
        });

        screenshotQueued = true;
        logger.info({ signalId: insertedSignal.id }, '📸 Screenshot encolado correctamente');
      } catch (error) {
        logger.error({ error: error.message }, '❌ Error encolando screenshot');
        // No fallar el webhook por error en screenshot
      }
    } else {
      if (!addScreenshotJob) {
        logger.info('⏭️ Screenshot omitido (BullMQ no disponible - modo desarrollo)');
      } else {
        logger.info('⏭️ Screenshot omitido (sin chart_id o cookies no configuradas)');
      }
    }

    // 7. RESPUESTA EXITOSA
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      message: 'Señal recibida y procesada correctamente',
      signal_id: insertedSignal.id,
      screenshot_queued: screenshotQueued,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack
    }, '❌ Error procesando webhook');

    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error procesando la señal'
    });
  }
});

/**
 * GET /webhook/:token
 * Health check del webhook del usuario
 */
router.get('/webhook/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const userConfig = await validateWebhookToken(token);

    if (!userConfig) {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido o deshabilitado'
      });
    }

    res.json({
      status: 'active',
      message: 'Tu webhook está funcionando correctamente ✅',
      user_id: userConfig.user_id,
      webhook_enabled: userConfig.webhook_enabled,
      cookies_configured: !!userConfig.tv_sessionid,
      cookies_valid: userConfig.cookies_valid,
      signals_quota: userConfig.signals_quota,
      signals_used: userConfig.signals_used_this_month,
      screenshot_resolution: userConfig.screenshot_resolution,
      usage: {
        method: 'POST',
        url: `/webhook/${token}`,
        body_example: {
          indicator: 'Mi Indicador',
          ticker: 'BINANCE:BTCUSDT',
          price: 45000.50,
          signal_type: 'BUY',
          direction: 'LONG',
          chart_id: 'xyz123',
          message: 'Señal de compra'
        }
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error en health check');
    res.status(500).json({
      status: 'error',
      message: 'Error verificando webhook'
    });
  }
});

/**
 * Extraer ticker del texto (formato EXCHANGE:SYMBOL o SYMBOL)
 */
function extractTicker(text) {
  if (!text) return null;

  // Buscar patrón: EXCHANGE:SYMBOL
  const exchangeTickerMatch = text.match(/([A-Z]+):([A-Z0-9.]+)/);
  if (exchangeTickerMatch) {
    return exchangeTickerMatch[0];
  }

  // Buscar patrón: Ticker: SYMBOL
  const tickerMatch = text.match(/Ticker:\s*([A-Z0-9.]+)/i);
  if (tickerMatch) {
    return tickerMatch[1];
  }

  return null;
}

/**
 * Extraer datos básicos del mensaje de texto
 */
function extractDataFromText(text) {
  const data = {};

  // Extraer ticker
  const ticker = extractTicker(text);
  if (ticker) {
    data.ticker = ticker;
    
    // Separar exchange y symbol
    if (ticker.includes(':')) {
      const [exchange, symbol] = ticker.split(':');
      data.exchange = exchange;
      data.symbol = symbol;
    }
  }

  // Extraer precio
  const priceMatch = text.match(/(?:Price|Precio|@)\s*[:\$]?\s*([0-9,]+\.?[0-9]*)/i);
  if (priceMatch) {
    data.price = parseFloat(priceMatch[1].replace(/,/g, ''));
  }

  // Detectar dirección
  if (/\b(LONG|BUY|COMPRA)\b/i.test(text)) {
    data.direction = 'LONG';
  } else if (/\b(SHORT|SELL|VENTA)\b/i.test(text)) {
    data.direction = 'SHORT';
  }

  return data;
}

module.exports = router;

