/**
 * Admin Routes - Gestión de Cookies TradingView
 * Simplificado para bot de Telegram
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { requireAdminToken, getCurrentAdminToken } = require('../utils/adminAuth');
const { logger: apiLogger } = require('../utils/logger');
const CookieManager = require('../utils/cookieManager');

// Instancia global de cookieManager
const cookieManager = new CookieManager();

/**
 * GET /admin
 * Panel de administración web (versión simplificada sin login)
 */
router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin-simple.html'));
});

/**
 * POST /admin/login
 * Login simplificado para desarrollo/testing (SIN validación de token)
 */
router.post('/admin/login', (req, res) => {
  try {
    // ✅ Modo desarrollo: Aceptar cualquier token
    // TODO: Habilitar validación en producción
    
    apiLogger.info('Admin login (development mode - no validation)');
    
    return res.json({
      success: true,
      message: 'Acceso concedido (modo desarrollo)',
      token: req.body.token || 'dev-mode'
    });

  } catch (error) {
    apiLogger.error({ error: error.message }, 'Login error');
    res.status(500).json({
      error: 'Error en login',
      message: error.message
    });
  }
});

/**
 * GET /admin-token
 * Obtener token admin (SOLO LOCALHOST)
 */
router.get('/admin-token', (req, res) => {
  // Solo permitir desde localhost
  const isLocalhost = req.ip === '127.0.0.1' || 
                      req.ip === '::1' || 
                      req.ip === '::ffff:127.0.0.1';

  if (!isLocalhost) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Este endpoint solo está disponible desde localhost'
    });
  }

  const token = getCurrentAdminToken();
  
  res.json({
    token,
    message: 'Token de administrador',
    expires: 'Al reiniciar el servidor'
  });
});

/**
 * GET /admin/cookies/status
 * Verificar estado actual de las cookies de TradingView
 */
router.get('/cookies/status', async (req, res) => {
  try {
    apiLogger.info('Checking cookie status');

    const cookieData = await cookieManager.loadCookies();

    if (!cookieData) {
      return res.json({
        valid: false,
        message: 'No hay cookies configuradas',
        last_updated: null
      });
    }

    // Validar cookies
    const isValid = await cookieManager.validateCookies(
      cookieData.sessionid, 
      cookieData.sessionid_sign
    );

    // Obtener datos del perfil si las cookies son válidas
    let profileData = null;
    if (isValid) {
      profileData = await cookieManager.getProfileData(
        cookieData.sessionid,
        cookieData.sessionid_sign
      );
    }

    res.json({
      valid: isValid,
      profile_data: profileData,
      last_updated: cookieData.timestamp
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
 * Actualizar cookies manualmente
 */
router.post('/cookies/update', async (req, res) => {
  try {
    const { sessionid, sessionid_sign } = req.body;

    if (!sessionid || !sessionid_sign) {
      return res.status(400).json({
        error: 'Cookies requeridas',
        message: 'Proporciona sessionid y sessionid_sign'
      });
    }

    // Validar cookies antes de guardar
    const isValid = await cookieManager.validateCookies(sessionid, sessionid_sign);

    if (!isValid) {
      return res.status(400).json({
        error: 'Cookies inválidas',
        message: 'Verifica que hayas copiado correctamente las cookies del navegador. Asegúrate de estar logueado en TradingView.'
      });
    }

    // Guardar cookies
    await cookieManager.saveCookies(sessionid, sessionid_sign);

    apiLogger.info('Cookies updated successfully via admin panel');

    res.json({
      success: true,
      message: 'Cookies actualizadas exitosamente'
    });

  } catch (error) {
    apiLogger.error({ error: error.message }, 'Cookie update error');

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
router.post('/cookies/clear', async (req, res) => {
  try {
    await cookieManager.clearCookies();

    apiLogger.info('Cookies cleared via admin panel');

    res.json({
      success: true,
      message: 'Cookies eliminadas exitosamente'
    });

  } catch (error) {
    apiLogger.error({ error: error.message }, 'Cookie clear error');

    res.status(500).json({
      error: 'Error eliminando cookies',
      message: error.message
    });
  }
});

module.exports = { 
  router,
  cookieManager // Exportar para uso en services
};
