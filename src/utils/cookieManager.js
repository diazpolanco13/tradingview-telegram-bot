/**
 * Cookie Manager - Maneja cookies de TradingView para autenticación
 * Basado en el sistema Python funcional que evita CAPTCHA
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class CookieManager {
  constructor(cookieFile = 'data/cookies.json') {
    this.cookieFile = cookieFile;
    this.ensureDataDirectory();
  }

  /**
   * Asegura que el directorio data/ exista
   */
  async ensureDataDirectory() {
    try {
      const dir = path.dirname(this.cookieFile);
      await fs.mkdir(dir, { recursive: true });

      // En Windows no podemos setear permisos como en Unix, pero podemos intentar
      // Para compatibilidad con Docker/Replit, esto es importante
    } catch (error) {
      console.warn('No se pudo crear directorio data:', error.message);
    }
  }

  /**
   * Guarda cookies en almacenamiento persistente
   * @param {string} sessionid - Cookie sessionid
   * @param {string} sessionid_sign - Cookie sessionid_sign
   */
  async saveCookies(sessionid, sessionid_sign) {
    const cookieData = {
      tv_sessionid: sessionid,
      tv_sessionid_sign: sessionid_sign,
      cookies_updated_at: new Date().toISOString()
    };

    try {
      await this.ensureDataDirectory();
      await fs.writeFile(this.cookieFile, JSON.stringify(cookieData, null, 2), 'utf8');

      // Intentar setear permisos (solo funciona en sistemas Unix-like)
      try {
        await fs.chmod(this.cookieFile, 0o600);
      } catch (chmodError) {
        // En Windows esto fallará, pero no es crítico
        console.debug('No se pudieron setear permisos del archivo (normal en Windows)');
      }

      console.log('✅ Cookies guardadas exitosamente en', this.cookieFile);
      return true;
    } catch (error) {
      console.error('❌ Error guardando cookies:', error.message);
      return false;
    }
  }

  /**
   * Carga cookies desde almacenamiento
   * @returns {Object|null} {sessionid, sessionid_sign, timestamp} o null si no existen
   */
  async loadCookies() {
    try {
      const data = await fs.readFile(this.cookieFile, 'utf8');
      const cookieData = JSON.parse(data);

      return {
        sessionid: cookieData.tv_sessionid,
        sessionid_sign: cookieData.tv_sessionid_sign,
        timestamp: cookieData.cookies_updated_at
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Error leyendo cookies:', error.message);
      }
      return null;
    }
  }

  /**
   * Valida cookies contra TradingView API
   * @param {string} sessionid
   * @param {string} sessionid_sign
   * @returns {boolean} true si cookies son válidas
   */
  async validateCookies(sessionid, sessionid_sign) {
    const headers = {
      'Cookie': `sessionid=${sessionid}; sessionid_sign=${sessionid_sign}`,
      'User-Agent': 'Mozilla/5.0 (compatible; TradingView API)',
      'Accept': 'application/json, text/plain, */*'
    };

    try {
      // Usar el endpoint que mencionas en el README: /tvcoins/details/
      const response = await axios.get('https://www.tradingview.com/tvcoins/details/', {
        headers,
        timeout: 10000
      });

      return response.status === 200;
    } catch (error) {
      console.debug('Validación de cookies falló:', error.message);
      return false;
    }
  }

  /**
   * Obtiene datos del perfil de TradingView (similar al sistema Python)
   * @param {string} sessionid
   * @param {string} sessionid_sign
   * @returns {Object|null} Datos del perfil o null si falla
   */
  async getProfileData(sessionid, sessionid_sign) {
    const headers = {
      'Cookie': `sessionid=${sessionid}; sessionid_sign=${sessionid_sign}`,
      'User-Agent': 'Mozilla/5.0 (compatible; TradingView API)',
      'Accept': 'application/json, text/plain, */*'
    };

    try {
      // Endpoint principal para datos de cuenta (como en el sistema Python)
      const response = await axios.get('https://www.tradingview.com/tvcoins/details/', {
        headers,
        timeout: 10000
      });

      if (response.status === 200) {
        const data = response.data;


        // Extraer datos básicos
        const profileData = {
          balance: data.partner_fiat_balance || 0,
          username: data.link || '',
          partner_status: data.partner_status || 0,
          affiliate_id: data.aff_id || 0,
          currency: data.currency || 'USD',
          partner_type: data.partner_type || '',
          last_verified: new Date().toISOString()
        };

        // Intentar extraer imagen de perfil usando multi-endpoint strategy
        if (profileData.username) {
          const profileImage = await this.extractProfileImage(profileData.username, headers);
          if (profileImage) {
            profileData.profile_image = profileImage;
          }
        }

        return profileData;
      }
    } catch (error) {
      console.debug('Error obteniendo datos del perfil:', error.message);
    }

    return null;
  }

  /**
   * Extrae imagen de perfil usando multi-endpoint strategy (como el sistema Python)
   * @param {string} username - Username de TradingView
   * @param {Object} headers - Headers con cookies
   * @returns {string|null} URL de imagen de perfil o null
   */
  async extractProfileImage(username, headers) {
    // Endpoints a probar (igual que el sistema Python)
    const endpoints = [
      `https://www.tradingview.com/pine_perm/get_author_data/?username=${username}`,
      `https://www.tradingview.com/u/${username}/`,
      'https://www.tradingview.com/accounts/me/',
      'https://www.tradingview.com/social/user/'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(endpoint, {
          headers,
          timeout: 8000
        });

        if (response.status === 200) {
          // Intentar JSON parsing primero
          try {
            const data = response.data;
            if (typeof data === 'object' && data !== null) {
              // Buscar campos de imagen
              for (const imgField of ['profile_image', 'avatar', 'image', 'userpic']) {
                if (data[imgField] && typeof data[imgField] === 'string') {
                  return data[imgField];
                }
              }
            }
          } catch {
            // Fallback: HTML parsing con regex (como el sistema Python)
            const content = response.data;
            if (typeof content === 'string' && (content.includes('userpic') || content.includes('avatar'))) {
              // Regex pattern del sistema Python
              const pattern = /https:\/\/s3\.tradingview\.com\/userpics\/[^"']*/g;
              const matches = content.match(pattern);
              if (matches && matches.length > 0) {
                return matches[0]; // Primera imagen válida
              }
            }
          }
        }
      } catch (error) {
        // Continuar con siguiente endpoint
        continue;
      }
    }

    return null;
  }

  /**
   * Borra cookies (útil para testing o renovación forzada)
   */
  async clearCookies() {
    try {
      await fs.unlink(this.cookieFile);
      console.log('🗑️ Cookies eliminadas');
      return true;
    } catch (error) {
      console.warn('Error eliminando cookies:', error.message);
      return false;
    }
  }
}

module.exports = CookieManager;
