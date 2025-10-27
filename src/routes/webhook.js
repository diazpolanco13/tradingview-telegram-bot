const express = require('express');
const router = express.Router();
const screenshotService = require('../services/screenshotService');
const telegramService = require('../services/telegramService');
const { logger } = require('../utils/logger');

/**
 * POST /webhook
 * Endpoint principal para recibir alertas de TradingView
 * 
 * Query Parameters:
 * - chart: ID del chart de TradingView (opcional)
 * - ticker: Símbolo del ticker (opcional, ej: BTCUSDT)
 * - delivery: 'asap' (mensaje primero) o 'together' (mensaje con screenshot)
 * - jsonRequest: 'true' para formatear JSON como tabla
 * 
 * Body: Mensaje de la alerta (string o JSON)
 */
router.post('/webhook', async (req, res) => {
  const startTime = Date.now();

  try {
    // Extraer parámetros
    const {
      chart,
      ticker: queryTicker,
      delivery = 'together',
      jsonRequest = 'false'
    } = req.query;

    // Procesar mensaje primero para poder extraer ticker si es necesario
    let message = '';
    
    if (typeof req.body === 'string') {
      message = req.body;
    } else if (typeof req.body === 'object') {
      if (jsonRequest === 'true') {
        // Formatear JSON como texto legible
        message = '```\n' + JSON.stringify(req.body, null, 2) + '\n```';
      } else {
        // Convertir a string simple
        message = JSON.stringify(req.body, null, 2);
      }
    } else {
      message = String(req.body || 'Alerta de TradingView');
    }

    // Extraer ticker del mensaje si no viene en query
    let ticker = queryTicker;
    if (!ticker || ticker.includes('{{')) {
      // Intentar extraer ticker del mensaje
      // Buscar patrón: "Ticker: EXCHANGE:SYMBOL" o "🪙 Ticker: EXCHANGE:SYMBOL"
      const tickerMatch = message.match(/Ticker:\s*([A-Z]+:[A-Z0-9.]+)/i);
      if (tickerMatch) {
        ticker = tickerMatch[1];
        logger.info({ extractedTicker: ticker }, '✅ Ticker extraído del mensaje');
      } else {
        ticker = null; // No usar ticker si tiene placeholders
      }
    }

    logger.info({
      chart,
      ticker,
      delivery,
      jsonRequest,
      hasBody: !!req.body
    }, '📨 Webhook procesado');

    // Envío ASAP: mensaje primero, screenshot después
    if (delivery === 'asap' && message) {
      await telegramService.sendMessage(message);
      logger.info('✅ Mensaje enviado (modo ASAP)');
    }

    // Capturar y enviar screenshot si hay chart
    if (chart) {
      logger.info({ chart, ticker }, '📸 Iniciando captura de screenshot...');
      
      const screenshot = await screenshotService.captureChart(chart, ticker);
      
      if (delivery === 'together') {
        // Enviar foto con mensaje como caption
        await telegramService.sendPhoto(screenshot, message);
        logger.info('✅ Screenshot + mensaje enviados (modo together)');
      } else {
        // Solo screenshot (mensaje ya enviado en ASAP)
        await telegramService.sendPhoto(screenshot);
        logger.info('✅ Screenshot enviado (modo ASAP)');
      }
    } else if (delivery !== 'asap') {
      // Solo mensaje, no hay chart
      await telegramService.sendMessage(message);
      logger.info('✅ Mensaje enviado (sin screenshot)');
    }

    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Alerta enviada exitosamente',
      duration_ms: duration,
      delivery_mode: delivery,
      had_screenshot: !!chart
    });

  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack
    }, '❌ Error procesando webhook');

    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error enviando alerta a Telegram'
    });
  }
});

/**
 * GET /webhook
 * Health check del webhook
 */
router.get('/webhook', (req, res) => {
  res.json({
    status: 'online',
    message: 'Webhook endpoint está funcionando. Usa POST para enviar alertas.',
    usage: {
      method: 'POST',
      url: '/webhook',
      query_params: {
        chart: 'ID del chart (opcional)',
        ticker: 'Símbolo del ticker (opcional)',
        delivery: 'asap o together (default: together)',
        jsonRequest: 'true o false (default: false)'
      },
      body: 'Mensaje de la alerta (string o JSON)'
    }
  });
});

module.exports = router;

