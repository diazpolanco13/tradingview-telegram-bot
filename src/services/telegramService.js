const TelegramBot = require('node-telegram-bot-api');
const { logger } = require('../utils/logger');

class TelegramService {
  constructor() {
    this.bot = null;
    this.channelId = null;
    this.initialized = false;
  }

  /**
   * Inicializar bot de Telegram
   */
  init() {
    if (this.initialized) return;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!token || !channelId) {
      logger.error('❌ TELEGRAM_BOT_TOKEN o TELEGRAM_CHANNEL_ID no configurados');
      throw new Error('Configuración de Telegram incompleta. Revisa las variables de entorno.');
    }

    try {
      this.bot = new TelegramBot(token, { polling: false });
      this.channelId = channelId;
      this.initialized = true;

      logger.info({ channelId }, '✅ Telegram bot inicializado correctamente');
    } catch (error) {
      logger.error({ error: error.message }, '❌ Error inicializando Telegram bot');
      throw error;
    }
  }

  /**
   * Enviar mensaje de texto a Telegram
   * @param {string} message - Mensaje a enviar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} Respuesta de Telegram
   */
  async sendMessage(message, options = {}) {
    if (!this.initialized) {
      this.init();
    }

    try {
      logger.info({ messageLength: message.length }, '📤 Enviando mensaje a Telegram...');

      const response = await this.bot.sendMessage(this.channelId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...options
      });

      logger.info({ messageId: response.message_id }, '✅ Mensaje enviado exitosamente');
      return response;

    } catch (error) {
      logger.error({ error: error.message }, '❌ Error enviando mensaje');
      throw error;
    }
  }

  /**
   * Enviar foto (screenshot) a Telegram
   * @param {Buffer} photoBuffer - Buffer de la imagen
   * @param {string} caption - Caption opcional
   * @returns {Promise<Object>} Respuesta de Telegram
   */
  async sendPhoto(photoBuffer, caption = '') {
    if (!this.initialized) {
      this.init();
    }

    try {
      logger.info({ 
        bufferSize: photoBuffer.length,
        hasCaption: !!caption 
      }, '📷 Enviando foto a Telegram...');

      const response = await this.bot.sendPhoto(this.channelId, photoBuffer, {
        caption: caption || undefined,
        parse_mode: caption ? 'Markdown' : undefined
      });

      logger.info({ messageId: response.message_id }, '✅ Foto enviada exitosamente');
      return response;

    } catch (error) {
      logger.error({ error: error.message }, '❌ Error enviando foto');
      throw error;
    }
  }

  /**
   * Enviar alerta completa (mensaje + opcional screenshot)
   * @param {string} message - Mensaje de la alerta
   * @param {Buffer|null} screenshot - Screenshot opcional
   * @returns {Promise<Array>} Respuestas de Telegram
   */
  async sendAlert(message, screenshot = null) {
    if (!this.initialized) {
      this.init();
    }

    const responses = [];

    try {
      if (screenshot) {
        // Enviar foto con caption
        const response = await this.sendPhoto(screenshot, message);
        responses.push(response);
      } else {
        // Solo mensaje
        const response = await this.sendMessage(message);
        responses.push(response);
      }

      return responses;

    } catch (error) {
      logger.error({ error: error.message }, '❌ Error enviando alerta');
      throw error;
    }
  }

  /**
   * Verificar configuración del bot
   * @returns {Promise<Object>} Info del bot
   */
  async verifyBot() {
    if (!this.initialized) {
      this.init();
    }

    try {
      const botInfo = await this.bot.getMe();
      logger.info({ botInfo }, 'ℹ️ Info del bot');
      return botInfo;
    } catch (error) {
      logger.error({ error: error.message }, '❌ Error verificando bot');
      throw error;
    }
  }

  /**
   * Obtener info del canal
   * @returns {Promise<Object>} Info del canal
   */
  async getChannelInfo() {
    if (!this.initialized) {
      this.init();
    }

    try {
      const chatInfo = await this.bot.getChat(this.channelId);
      logger.info({ chatInfo }, 'ℹ️ Info del canal');
      return chatInfo;
    } catch (error) {
      logger.error({ error: error.message }, '❌ Error obteniendo info del canal');
      throw error;
    }
  }
}

module.exports = new TelegramService();

