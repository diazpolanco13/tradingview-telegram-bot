/**
 * Screenshot Worker
 * Procesa jobs de screenshots de forma asíncrona usando BullMQ
 * 
 * Features:
 * - POST directo a TradingView /snapshot/ para URLs gratis
 * - Fallback a Supabase Storage si TradingView falla
 * - Notificaciones opcionales a Telegram por usuario
 */

const { Worker } = require('bullmq');
const { updateScreenshotStatus, supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

// Importar servicios
const screenshotService = require('../services/screenshotService');
const TelegramBot = require('node-telegram-bot-api');

// Worker instance (se inicializa externamente)
let workerInstance = null;

/**
 * Enviar notificación a Telegram del usuario
 * @param {Object} signalData - Datos de la señal
 * @param {Object} userConfig - Configuración del usuario
 */
async function sendTelegramNotification(signalData, userConfig) {
  try {
    // Verificar si el usuario tiene Telegram habilitado
    if (!userConfig.telegram_enabled || !userConfig.telegram_bot_token || !userConfig.telegram_chat_id) {
      logger.debug('📱 Telegram deshabilitado para este usuario');
      return;
    }

    logger.info({ 
      chatId: userConfig.telegram_chat_id,
      ticker: signalData.ticker 
    }, '📱 Enviando notificación a Telegram...');

    // Crear instancia del bot del usuario
    const bot = new TelegramBot(userConfig.telegram_bot_token, { polling: false });

    // Formatear mensaje (formato compacto - sin saltos extras)
    // Construir líneas de forma dinámica
    const lines = [
      '🚨 *Nueva Señal de Trading*',
      '',
      `🪙 *Ticker:* ${signalData.ticker}`,
      `💰 *Precio:* $${signalData.price}`,
      `📊 *Señal:* ${signalData.signal_type || 'N/A'}`
    ];
    
    // Agregar dirección si existe
    if (signalData.direction) {
      lines.push(`📈 *Dirección:* ${signalData.direction}`);
    }
    
    // Agregar indicador si existe
    if (signalData.indicator) {
      lines.push(`🔧 *Indicador:* ${signalData.indicator}`);
    }
    
    // Timestamp y Screenshot juntos (sin salto entre ellos)
    lines.push(`⏰ ${new Date(signalData.timestamp).toLocaleString('es-ES', { timeZone: userConfig.preferred_timezone || 'UTC' })}`);
    
    // Screenshot si existe }
    lines.push('');
    if (signalData.screenshot_url) {
      lines.push(`📸 [Ver Screenshot en TradingView](${signalData.screenshot_url})`);
    }
    
    // ID de señal (sin salto de línea antes)
    lines.push(`_Señal #${signalData.id.split('-')[0]}_`);
    
    const message = lines.join('\n');

    // Enviar mensaje
    await bot.sendMessage(userConfig.telegram_chat_id, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: false
    });

    logger.info('✅ Notificación enviada a Telegram correctamente');

  } catch (error) {
    logger.error({ 
      error: error.message,
      chatId: userConfig.telegram_chat_id 
    }, '❌ Error enviando notificación a Telegram');
    
    // No lanzar error - notificación es opcional
    // La señal ya está guardada en Supabase
  }
}

/**
 * Iniciar el Worker de screenshots
 * @param {Object} redisConnection - Conexión activa de Redis
 * @returns {Worker} - Worker instance
 */
function startWorker(redisConnection) {
  if (workerInstance) {
    logger.warn('⚠️ Worker ya está corriendo');
    return workerInstance;
  }

  if (!redisConnection) {
    logger.error('❌ No se puede iniciar worker sin conexión Redis');
    return null;
  }

  logger.info('🔄 Inicializando Screenshot Worker...');

  workerInstance = new Worker(
    'screenshot-processing',
    async (job) => {
      const { signalId, userId, ticker, chartId, cookies, resolution } = job.data;

      logger.info(`🔄 Procesando screenshot para señal ${signalId} - ${ticker}`);

      try {
        // 1. Actualizar estado a "processing"
        await updateScreenshotStatus(signalId, 'processing');

        // 2. ✨ MÉTODO PRINCIPAL: TradingView Share (POST directo)
        logger.info('✨ Intentando TradingView Share (POST directo)...');
        
        let shareUrl = null;
        let method = 'tradingview_share';
        
        try {
          shareUrl = await screenshotService.captureWithTradingViewShare(
            ticker,
            chartId,
            cookies
          );

          if (shareUrl) {
            logger.info({ shareUrl }, '✅ TradingView Share URL obtenida');
          }
        } catch (shareError) {
          logger.warn(`⚠️ TradingView Share falló: ${shareError.message}`);
          logger.info('🔄 Intentando fallback: captura manual + Supabase Storage...');
          
          // 🔄 FALLBACK: Captura manual + upload a Supabase Storage
          try {
            const screenshotBuffer = await screenshotService.captureWithUserCookies(
              ticker,
              chartId,
              cookies,
              resolution || '1080p'
            );

            // Upload a Supabase Storage
            const filename = `${signalId}-${Date.now()}.png`;
            const { data: uploadData, error: uploadError } = await supabase
              .storage
              .from('trading-screenshots')
              .upload(`${userId}/${filename}`, screenshotBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              throw new Error(`Error subiendo a Storage: ${uploadError.message}`);
            }

            // Obtener URL pública
            const { data: { publicUrl } } = supabase
              .storage
              .from('trading-screenshots')
              .getPublicUrl(`${userId}/${filename}`);

            shareUrl = publicUrl;
            method = 'supabase_storage_fallback';
            
            logger.info({ shareUrl }, '✅ Screenshot subido a Supabase Storage (fallback)');
          } catch (fallbackError) {
            logger.error(`❌ Fallback también falló: ${fallbackError.message}`);
            throw new Error(`Ambos métodos fallaron: Share=${shareError.message}, Fallback=${fallbackError.message}`);
          }
        }

        if (!shareUrl) {
          throw new Error('No se pudo obtener URL del screenshot (ambos métodos fallaron)');
        }

        // 3. Guardar URL en Supabase
        const { data, error } = await supabase
          .from('trading_signals')
          .update({ 
            screenshot_url: shareUrl,
            screenshot_status: 'completed'
          })
          .eq('id', signalId)
          .select()
          .single();

        if (error) {
          throw new Error(`Error actualizando señal: ${error.message}`);
        }

        logger.info(`✅ Screenshot completado: ${signalId} - Método: ${method}`);

        // 4. 📱 ENVIAR NOTIFICACIÓN A TELEGRAM (OPCIONAL)
        // Obtener configuración completa del usuario para Telegram
        const { data: userConfig, error: configError } = await supabase
          .from('trading_signals_config')
          .select('telegram_enabled, telegram_bot_token, telegram_chat_id, preferred_timezone')
          .eq('user_id', userId)
          .single();

        if (!configError && userConfig) {
          // Enviar notificación si está habilitado
          await sendTelegramNotification({
            id: signalId,
            ticker,
            price: data.price,
            signal_type: data.signal_type,
            direction: data.direction,
            indicator: data.indicator_name,
            screenshot_url: shareUrl,
            timestamp: data.timestamp
          }, userConfig);
        }

        return {
          success: true,
          signalId,
          screenshotUrl: shareUrl,
          method,
          telegram_sent: userConfig?.telegram_enabled || false
        };
      } catch (error) {
        logger.error(`❌ Error procesando screenshot ${signalId}:`, error.message);

        // Actualizar estado a "failed"
        await updateScreenshotStatus(signalId, 'failed');

        throw error; // BullMQ reintentará según configuración
      }
    },
    {
      connection: redisConnection,
      concurrency: 2, // Procesar 2 screenshots simultáneamente
      limiter: {
        max: 10, // Máximo 10 jobs
        duration: 60000 // Por minuto
      }
    }
  );

  /**
   * Eventos del worker
   */
  workerInstance.on('completed', (job) => {
    logger.info(`✅ Worker completó job: ${job.id}`);
  });

  workerInstance.on('failed', (job, error) => {
    logger.error(`❌ Worker falló job: ${job?.id} - ${error.message}`);
  });

  workerInstance.on('error', (error) => {
    logger.error('❌ Error en el worker:', error.message);
  });

  workerInstance.on('stalled', (jobId) => {
    logger.warn(`⚠️ Job estancado detectado: ${jobId}`);
  });

  logger.info('✅ Screenshot Worker inicializado correctamente');
  
  return workerInstance;
}

/**
 * Graceful shutdown del worker
 */
async function stopWorker() {
  if (!workerInstance) return;
  
  try {
    await workerInstance.close();
    workerInstance = null;
    logger.info('🛑 Screenshot worker cerrado correctamente');
  } catch (error) {
    logger.error('❌ Error cerrando worker:', error.message);
  }
}

module.exports = {
  startWorker,
  stopWorker,
  getWorkerInstance: () => workerInstance
};
