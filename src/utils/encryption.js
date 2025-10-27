/**
 * Encryption Utility for TradingView Cookies
 * Encripta y desencripta cookies sensibles usando AES-256-GCM
 */

const crypto = require('crypto');
const { logger } = require('./logger');

// Algoritmo de encriptación
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes para GCM
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Obtener la clave de encriptación desde .env
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    logger.error('❌ ENCRYPTION_KEY no está definida en .env');
    throw new Error('ENCRYPTION_KEY is required');
  }

  if (key.length !== 64) {
    logger.error('❌ ENCRYPTION_KEY debe ser un string hexadecimal de 64 caracteres (32 bytes)');
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Generar una clave derivada usando PBKDF2
 * @param {Buffer} password - Contraseña base
 * @param {Buffer} salt - Salt para derivación
 * @returns {Buffer} - Clave derivada de 32 bytes
 */
function getKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
}

/**
 * Encriptar un texto usando AES-256-GCM
 * @param {string} text - Texto a encriptar
 * @returns {string} - Texto encriptado en formato hexadecimal
 */
function encrypt(text) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Text to encrypt must be a non-empty string');
    }

    const masterKey = getEncryptionKey();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey(masterKey, salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(String(text), 'utf8'),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    // Formato: salt + iv + tag + encrypted
    const result = Buffer.concat([salt, iv, tag, encrypted]);

    return result.toString('hex');
  } catch (error) {
    logger.error('❌ Error encriptando:', error.message);
    throw error;
  }
}

/**
 * Desencriptar un texto encriptado con AES-256-GCM
 * @param {string} encryptedText - Texto encriptado en formato hexadecimal
 * @returns {string} - Texto desencriptado
 */
function decrypt(encryptedText) {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error('Encrypted text must be a non-empty string');
    }

    const masterKey = getEncryptionKey();
    const stringValue = Buffer.from(String(encryptedText), 'hex');

    // Extraer componentes
    const salt = stringValue.subarray(0, SALT_LENGTH);
    const iv = stringValue.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = stringValue.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = stringValue.subarray(ENCRYPTED_POSITION);

    const key = getKey(masterKey, salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = decipher.update(encrypted) + decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('❌ Error desencriptando:', error.message);
    throw error;
  }
}

/**
 * Encriptar cookies de TradingView
 * @param {string} sessionid - Cookie sessionid
 * @param {string} sessionid_sign - Cookie sessionid_sign
 * @returns {Object} - Objeto con cookies encriptadas
 */
function encryptTradingViewCookies(sessionid, sessionid_sign) {
  try {
    return {
      tv_sessionid: encrypt(sessionid),
      tv_sessionid_sign: encrypt(sessionid_sign)
    };
  } catch (error) {
    logger.error('❌ Error encriptando cookies de TradingView:', error.message);
    throw error;
  }
}

/**
 * Desencriptar cookies de TradingView
 * @param {string} encryptedSessionid - Cookie sessionid encriptada
 * @param {string} encryptedSessionidSign - Cookie sessionid_sign encriptada
 * @returns {Object} - Objeto con cookies desencriptadas
 */
function decryptTradingViewCookies(encryptedSessionid, encryptedSessionidSign) {
  try {
    if (!encryptedSessionid || !encryptedSessionidSign) {
      throw new Error('Encrypted cookies are required');
    }

    return {
      sessionid: decrypt(encryptedSessionid),
      sessionid_sign: decrypt(encryptedSessionidSign)
    };
  } catch (error) {
    logger.error('❌ Error desencriptando cookies de TradingView:', error.message);
    throw error;
  }
}

/**
 * Generar una nueva ENCRYPTION_KEY
 * Útil para producción - ejecutar una sola vez
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  encrypt,
  decrypt,
  encryptTradingViewCookies,
  decryptTradingViewCookies,
  generateEncryptionKey
};

