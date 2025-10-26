/**
 * Admin Routes - Gestión de Cookies TradingView
 * Endpoints similares al sistema Python funcional
 */

const express = require('express');
const router = express.Router();
const { requireAdminToken, validateAdminToken, getCurrentAdminToken } = require('../utils/adminAuth');
const { apiLogger } = require('../utils/logger');
const { apiAuth } = require('../middleware/apiAuth');

// Importar TradingView service para gestión de cookies
let tradingViewService = null;

// Función para setear el servicio (se llama desde server.js)
function setTradingViewService(service) {
  tradingViewService = service;
}

/**
 * GET /admin/get-token
 * Obtener token admin usando X-API-Key (accesible remotamente)
 * 
 * Este endpoint permite obtener el token admin desde cualquier lugar
 * usando la X-API-Key existente (la misma que usa el e-commerce)
 * 
 * @requires X-API-Key header
 * @returns {object} Token de administrador actual
 */
router.get('/get-token', apiAuth, (req, res) => {
  try {
    const token = getCurrentAdminToken();
    
    if (!token) {
      return res.status(500).json({
        error: 'Token no disponible',
        message: 'El servidor no ha generado un token admin'
      });
    }
    
    apiLogger.info({
      ip: req.ip || req.connection.remoteAddress,
      method: 'GET /admin/get-token'
    }, 'Admin token retrieved via API Key');
    
    res.json({
      success: true,
      token: token,
      message: 'Token admin obtenido exitosamente',
      usage: 'Usa este token con X-Admin-Token header o en el panel /admin',
      expiresOn: 'Cambia cada vez que se reinicia el servidor'
    });
  } catch (error) {
    apiLogger.error({ error: error.message }, 'Error getting admin token');
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

/**
 * POST /admin/login
 * Login de admin con token (similar al sistema Python)
 */
router.post('/login', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token requerido',
        message: 'Proporciona un token de administrador'
      });
    }

    if (validateAdminToken(token)) {
      // En un sistema real usaríamos sesiones, pero por simplicidad devolvemos éxito
      apiLogger.info('Admin login successful');
      res.json({
        success: true,
        message: 'Login exitoso',
        redirect: '/admin'
      });
    } else {
      apiLogger.warn({ token: token.substring(0, 10) + '...' }, 'Invalid admin token attempt');
      res.status(401).json({
        error: 'Token inválido',
        message: 'Token de administrador incorrecto'
      });
    }
  } catch (error) {
    apiLogger.error({ error: error.message }, 'Admin login error');
    res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

/**
 * GET /admin/cookies/status
 * Verificar estado actual de las cookies
 */
router.get('/cookies/status', requireAdminToken, async (req, res) => {
  try {
    if (!tradingViewService) {
      return res.status(500).json({
        error: 'Servicio no disponible',
        message: 'TradingView service not initialized'
      });
    }

    const isAuthenticated = tradingViewService.isAuthenticated();
    let profileData = null;
    let username = null;

    if (isAuthenticated) {
      // Intentar obtener datos del perfil (similar al sistema Python)
      profileData = await tradingViewService.getProfileData();

      // Si getProfileData() falla, intentar validación alternativa con Pine Script API
      if (!profileData) {
        apiLogger.debug('Profile data unavailable, trying alternative validation');
        try {
          // Intentar una operación de solo lectura para validar cookies
          const validationResult = await tradingViewService.validateCookiesWithPineAPI();
          if (validationResult && validationResult.valid) {
            // Cookies son válidas, crear profileData básico
            profileData = {
              balance: 'N/A (validado con Pine API)',
              username: validationResult.username || 'unknown',
              partner_status: 'N/A',
              affiliate_id: 'N/A',
              currency: 'USD',
              partner_type: 'N/A',
              last_verified: new Date().toISOString(),
              validation_method: 'pine_api_fallback'
            };
            username = profileData.username;
            apiLogger.info('Cookie validation successful using Pine API fallback');
          }
        } catch (fallbackError) {
          apiLogger.debug({ error: fallbackError.message }, 'Pine API validation also failed');
        }
      } else {
        username = profileData.username;
      }
    }

    // Obtener timestamp de última actualización de cookies
    const cookieData = await tradingViewService.cookieManager.loadCookies();

    res.json({
      valid: isAuthenticated,
      username: username,
      profile_data: profileData,
      last_updated: cookieData ? cookieData.timestamp : null
    });

  } catch (error) {
    apiLogger.error({ error: error.message }, 'Cookie status check error');
    res.status(500).json({
      error: 'Error verificando cookies',
      message: error.message
    });
  }
});

/**
 * POST /admin/cookies/update
 * Actualizar cookies manualmente (similar al sistema Python)
 */
router.post('/cookies/update', requireAdminToken, async (req, res) => {
  try {
    const { sessionid, sessionid_sign } = req.body;

    if (!sessionid || !sessionid_sign) {
      return res.status(400).json({
        error: 'Cookies requeridas',
        message: 'Proporciona sessionid y sessionid_sign'
      });
    }

    if (!tradingViewService) {
      return res.status(500).json({
        error: 'Servicio no disponible',
        message: 'TradingView service not initialized'
      });
    }

    // Actualizar cookies usando el servicio
    const result = await tradingViewService.updateCookies(sessionid, sessionid_sign);

    apiLogger.info('Cookies updated successfully via admin panel');

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    apiLogger.error({ error: error.message }, 'Cookie update error');

    // Mensaje específico para cookies inválidas
    if (error.message.includes('Cookies inválidas')) {
      return res.status(400).json({
        error: 'Cookies inválidas',
        message: 'Verifica que hayas copiado correctamente las cookies del navegador. Asegúrate de estar logueado en TradingView.'
      });
    }

    res.status(500).json({
      error: 'Error actualizando cookies',
      message: error.message
    });
  }
});

/**
 * POST /admin/cookies/clear
 * Limpiar cookies (para testing o renovación forzada)
 */
router.post('/cookies/clear', requireAdminToken, async (req, res) => {
  try {
    if (!tradingViewService) {
      return res.status(500).json({
        error: 'Servicio no disponible',
        message: 'TradingView service not initialized'
      });
    }

    const cleared = await tradingViewService.cookieManager.clearCookies();

    if (cleared) {
      // Resetear propiedades del servicio
      tradingViewService.sessionId = null;
      tradingViewService.sessionIdSign = null;

      apiLogger.info('Cookies cleared via admin panel');
      res.json({
        success: true,
        message: 'Cookies eliminadas exitosamente'
      });
    } else {
      res.status(500).json({
        error: 'Error eliminando cookies',
        message: 'No se pudieron eliminar las cookies'
      });
    }

  } catch (error) {
    apiLogger.error({ error: error.message }, 'Cookie clear error');
    res.status(500).json({
      error: 'Error eliminando cookies',
      message: error.message
    });
  }
});

/**
 * GET /profile/:username
 * Get user profile image URL (public endpoint - no authentication required)
 * Based on the Python implementation that scrapes public profile pages
 */
router.get('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Validate username
    if (!username || typeof username !== 'string' || username.length === 0) {
      return res.status(400).json({
        success: false,
        username: username,
        message: 'Username is required'
      });
    }

    // Public profile endpoint (no cookies needed)
    const profileUrl = `https://www.tradingview.com/u/${username}`;

    // Headers for public access
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; TradingView API)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    };

    const response = await axios.get(profileUrl, {
      headers,
      timeout: 10000
    });

    if (response.status === 200) {
      const htmlContent = response.data;

      // Check if userpic or avatar is present in HTML
      if (htmlContent.includes('userpic') || htmlContent.includes('avatar')) {
        // Extract profile image URL using regex (same pattern as Python)
        const imgPattern = /https:\/\/s3\.tradingview\.com\/userpics\/[^"']*/g;
        const matches = htmlContent.match(imgPattern);

        if (matches && matches.length > 0) {
          const profileImageUrl = matches[0];

          return res.json({
            success: true,
            username: username,
            profile_image: profileImageUrl,
            source: 'public_profile'
          });
        }
      }

      // If no image found
      return res.status(404).json({
        success: false,
        username: username,
        profile_image: null,
        message: 'Profile image not found or user does not exist'
      });
    } else {
      return res.status(404).json({
        success: false,
        username: username,
        profile_image: null,
        message: 'User not found or profile not accessible'
      });
    }

  } catch (error) {
    // Handle different error types
    if (error.response) {
      // HTTP error response
      if (error.response.status === 404) {
        return res.status(404).json({
          success: false,
          username: req.params.username,
          profile_image: null,
          message: 'Profile image not found or user does not exist'
        });
      }
    }

    // Generic error
    return res.status(500).json({
      success: false,
      username: req.params.username,
      error: 'Failed to fetch profile image',
      message: error.message
    });
  }
});

module.exports = {
  router,
  setTradingViewService
};
